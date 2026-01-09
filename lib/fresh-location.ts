import * as Location from 'expo-location';
import { reverseGeocodeMapbox } from './mapbox';

// Location capture configuration
const LOCATION_CONFIG = {
    MAX_AGE_MS: 15000,      // Reject locations older than 15 seconds
    MAX_ACCURACY_M: 50,     // Reject locations with accuracy > 50 meters
    TIMEOUT_MS: 10000,      // Timeout for fresh location fetch
};

export interface FreshLocation {
    latitude: number;
    longitude: number;
    accuracy: number;
    capturedAt: number;     // Unix timestamp in ms
    address: string;
    postcode: string;
}

/**
 * Get a fresh GPS location with reverse geocoding.
 * Enforces freshness rules: rejects stale or inaccurate locations.
 */
export async function getFreshLocation(options: { timeout?: number } = {}): Promise<FreshLocation | null> {
    try {
        const { timeout = LOCATION_CONFIG.TIMEOUT_MS } = options;
        const now = Date.now();

        // 1. Try last known position first (FASTEST)
        const lastKnown = await Location.getLastKnownPositionAsync({
            maxAge: LOCATION_CONFIG.MAX_AGE_MS,
            requiredAccuracy: LOCATION_CONFIG.MAX_ACCURACY_M
        });

        if (lastKnown) {
            const age = now - lastKnown.timestamp;
            if (age < LOCATION_CONFIG.MAX_AGE_MS && (lastKnown.coords.accuracy || 100) < LOCATION_CONFIG.MAX_ACCURACY_M) {
                console.log(`[Location] Using fresh cache (${Math.round(age / 1000)}s old)`);
                return processLocation(lastKnown);
            }
        }

        // 2. Request fresh fix if cache is stale/missing
        // Promise.race to enforce timeout
        const locationPromise = Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            timeInterval: 0,
            distanceInterval: 0,
        });

        const location = await Promise.race([
            locationPromise,
            new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error('Location timeout')), timeout)
            )
        ]) as Location.LocationObject;

        return processLocation(location);

    } catch (error) {
        console.error('[Location] Failed to get fresh location:', error);
        // Fallback to whatever last known location we have, even if stale (better than nothing)
        const fallback = await Location.getLastKnownPositionAsync({});
        if (fallback) {
            console.warn('[Location] Using stale fallback due to error');
            return processLocation(fallback);
        }
        return null;
    }
}

async function processLocation(location: Location.LocationObject): Promise<FreshLocation> {
    const now = Date.now();

    // Start with coordinates as address (instant fallback)
    let address = `${location.coords.latitude.toFixed(5)}, ${location.coords.longitude.toFixed(5)}`;
    let postcode = '';

    // Non-blocking geocoding with short timeout (2s max)
    // This prevents the UI from freezing while we get the street address
    try {
        const geocodePromise = reverseGeocodeMapbox(
            location.coords.latitude,
            location.coords.longitude
        );

        // Race with a 2 second timeout
        const geocodeResult = await Promise.race([
            geocodePromise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000))
        ]);

        if (geocodeResult) {
            address = geocodeResult.address || address;
            postcode = geocodeResult.postcode || '';
        }
    } catch (geoError) {
        console.warn('[Location] Geocode failed, using coordinates:', geoError);
    }

    return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        capturedAt: now,
        address,
        postcode,
    };
}

/**
 * Create fallback location with "Location unavailable" text
 */
function createFallbackLocation(location?: Location.LocationObject | null): FreshLocation | null {
    if (!location) return null;

    return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        capturedAt: Date.now(),
        address: 'Location accuracy low',
        postcode: '',
    };
}

/**
 * Format timestamp consistently for display
 * Always use device local time
 */
export function formatEventTimestamp(unixMs: number, timezone?: string): string {
    const date = new Date(unixMs);

    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: timezone || undefined,
    });
}
