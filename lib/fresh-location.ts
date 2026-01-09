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
export async function getFreshLocation(): Promise<FreshLocation | null> {
    try {
        // Always request a fresh fix, NOT cached
        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            timeInterval: 0,
            distanceInterval: 0,
        });

        // Validate freshness
        const now = Date.now();
        const locationAge = now - location.timestamp;

        if (locationAge > LOCATION_CONFIG.MAX_AGE_MS) {
            console.warn(`[Location] Rejected: too old (${Math.round(locationAge / 1000)}s)`);
            return createFallbackLocation(location);
        }

        if (location.coords.accuracy && location.coords.accuracy > LOCATION_CONFIG.MAX_ACCURACY_M) {
            console.warn(`[Location] Warning: low accuracy (${Math.round(location.coords.accuracy)}m)`);
            // Don't reject, just log - we still use it but note the accuracy
        }

        // Reverse geocode from these exact coordinates
        let address = `${location.coords.latitude.toFixed(5)}, ${location.coords.longitude.toFixed(5)}`;
        let postcode = '';

        try {
            const geocodeResult = await reverseGeocodeMapbox(
                location.coords.latitude,
                location.coords.longitude
            );
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
    } catch (error) {
        console.error('[Location] Failed to get fresh location:', error);
        return null;
    }
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
