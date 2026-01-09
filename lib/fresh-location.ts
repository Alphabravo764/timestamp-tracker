import * as Location from 'expo-location';
import { reverseGeocodeMapbox } from './mapbox';

// FAST location capture configuration - prioritize speed over accuracy
const LOCATION_CONFIG = {
    MAX_AGE_MS: 60000,      // Accept locations up to 60 seconds old (more lenient)
    MAX_ACCURACY_M: 100,    // Accept up to 100 meters accuracy
    TIMEOUT_MS: 2000,       // Very short timeout - 2 seconds max for fresh location
    GEOCODE_TIMEOUT_MS: 1500, // 1.5s max for geocoding
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
 * Get GPS location FAST with reverse geocoding.
 * Prioritizes speed - will use cached location if available.
 * Never blocks for more than ~3 seconds total.
 */
export async function getFreshLocation(options: { timeout?: number } = {}): Promise<FreshLocation | null> {
    const { timeout = LOCATION_CONFIG.TIMEOUT_MS } = options;
    const now = Date.now();

    try {
        // STEP 1: Try last known position FIRST (should be instant)
        let location: Location.LocationObject | null = null;

        try {
            location = await Location.getLastKnownPositionAsync({
                maxAge: LOCATION_CONFIG.MAX_AGE_MS,
                requiredAccuracy: LOCATION_CONFIG.MAX_ACCURACY_M
            });
        } catch (e) {
            console.warn('[Location] getLastKnown failed:', e);
        }

        // If we have a recent enough location, use it immediately
        if (location) {
            const age = now - location.timestamp;
            console.log(`[Location] Using cached location (${Math.round(age / 1000)}s old)`);
            return processLocationFast(location);
        }

        // STEP 2: Try fresh location with SHORT timeout (non-blocking)
        console.log('[Location] No cache, trying fresh location...');

        try {
            const freshLocation = await Promise.race([
                Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced, // Balanced is faster than High
                    timeInterval: 0,
                    distanceInterval: 0,
                }),
                new Promise<null>((resolve) =>
                    setTimeout(() => resolve(null), timeout)
                )
            ]) as Location.LocationObject | null;

            if (freshLocation) {
                console.log('[Location] Got fresh location');
                return processLocationFast(freshLocation);
            }
        } catch (e) {
            console.warn('[Location] Fresh location failed:', e);
        }

        // STEP 3: Ultimate fallback - any last known position (no restrictions)
        console.log('[Location] Using unrestricted fallback...');
        try {
            const fallback = await Promise.race([
                Location.getLastKnownPositionAsync({}),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000))
            ]) as Location.LocationObject | null;

            if (fallback) {
                return processLocationFast(fallback);
            }
        } catch (e) {
            console.warn('[Location] Fallback failed:', e);
        }

        // No location available at all
        console.error('[Location] All location methods failed');
        return null;

    } catch (error) {
        console.error('[Location] Unexpected error:', error);
        return null;
    }
}

/**
 * Process location FAST - geocoding is fire-and-forget in background
 * Returns immediately with coordinates, then updates address if available
 */
async function processLocationFast(location: Location.LocationObject): Promise<FreshLocation> {
    const now = Date.now();
    const lat = location.coords.latitude;
    const lng = location.coords.longitude;

    // Start with coordinates as address (instant)
    let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    let postcode = '';

    // Quick geocoding attempt with very short timeout
    try {
        const geocodeResult = await Promise.race([
            reverseGeocodeMapbox(lat, lng),
            new Promise<null>((resolve) =>
                setTimeout(() => resolve(null), LOCATION_CONFIG.GEOCODE_TIMEOUT_MS)
            )
        ]);

        if (geocodeResult) {
            address = geocodeResult.address || address;
            postcode = geocodeResult.postcode || '';
        }
    } catch (e) {
        // Silently fail - we have coordinates which is enough
    }

    return {
        latitude: lat,
        longitude: lng,
        accuracy: location.coords.accuracy || 0,
        capturedAt: now,
        address,
        postcode,
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
