/**
 * Mapbox utilities for static maps and geocoding
 */

const MAPBOX_TOKEN = 'pk.eyJ1IjoiYWJkdWxic2lhbDExMjIiLCJhIjoiY21qenJjZjN3NjhrejNlcXh0NTE2M3RhaCJ9.WKftvZP3RnQoncVDdDfBiw';

export interface MapboxGeocodingResult {
    address: string;
    street: string;
    postcode: string;
    city: string;
    country: string;
}

/**
 * Reverse geocode using Mapbox Geocoding API
 */
export async function reverseGeocodeMapbox(lat: number, lng: number): Promise<MapboxGeocodingResult | null> {
    try {
        const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=address,poi,locality`
        );

        const data = await response.json();

        if (!data.features?.[0]) {
            return null;
        }

        const feature = data.features[0];
        const context = feature.context || [];

        let street = "";
        let postcode = "";
        let city = "";
        let country = "";

        // Parse context for location components
        for (const ctx of context) {
            if (ctx.id.startsWith("postcode")) postcode = ctx.text;
            if (ctx.id.startsWith("place") || ctx.id.startsWith("locality")) city = ctx.text;
            if (ctx.id.startsWith("country")) country = ctx.text;
        }

        // Main text is often the street address
        street = feature.text || "";
        if (feature.address) {
            street = `${feature.address} ${street}`;
        }

        return {
            address: feature.place_name || "",
            street: street || "",
            postcode: postcode || "",
            city: city || "",
            country: country || "",
        };
    } catch (error) {
        console.error("Mapbox geocoding error:", error);
        return null;
    }
}

/**
 * Format address for display
 */
export function formatMapboxAddress(geo: MapboxGeocodingResult | null): string {
    if (!geo) return "";

    const parts: string[] = [];
    if (geo.street) parts.push(geo.street);
    if (geo.city) parts.push(geo.city);
    if (geo.postcode) parts.push(geo.postcode);

    return parts.join(", ");
}

/**
 * Encode polyline for Mapbox Static Images API
 * https://github.com/mapbox/polyline
 */
function encodePolyline(locations: { latitude: number; longitude: number }[]): string {
    let encoded = "";
    let prevLat = 0;
    let prevLng = 0;

    for (const loc of locations) {
        const lat = Math.round(loc.latitude * 1e5);
        const lng = Math.round(loc.longitude * 1e5);

        encoded += encodeNumber(lat - prevLat);
        encoded += encodeNumber(lng - prevLng);

        prevLat = lat;
        prevLng = lng;
    }

    return encoded;
}

function encodeNumber(num: number): string {
    let encoded = "";
    let value = num < 0 ? ~(num << 1) : num << 1;

    while (value >= 0x20) {
        encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
        value >>= 5;
    }

    encoded += String.fromCharCode(value + 63);
    return encoded;
}

/**
 * Generate Mapbox Static Images API URL with trail polyline
 * Uses the Mapbox Static Images API: https://docs.mapbox.com/api/maps/static-images/
 */
export function generateMapboxStaticUrl(
    locations: { latitude: number; longitude: number; accuracy?: number }[],
    width: number = 800,
    height: number = 400
): string {
    if (locations.length === 0) {
        return "";
    }

    // Filter out low accuracy points
    const filteredLocations = locations.filter(loc => !loc.accuracy || loc.accuracy < 50);

    if (filteredLocations.length === 0) {
        return "";
    }

    const start = filteredLocations[0];
    const end = filteredLocations[filteredLocations.length - 1];

    // Build overlays array
    const overlays: string[] = [];

    // Add polyline path if we have multiple points
    if (filteredLocations.length > 1) {
        // Sample points if too many
        const maxPoints = 100;
        const step = Math.max(1, Math.floor(filteredLocations.length / maxPoints));
        const sampledLocations = filteredLocations.filter((_, i) => i % step === 0 || i === filteredLocations.length - 1);

        // Encode polyline
        const encodedPath = encodePolyline(sampledLocations);
        // Use URL-safe base64 encoding for the path
        const pathOverlay = `path-4+3b82f6-0.8(${encodeURIComponent(encodedPath)})`;
        overlays.push(pathOverlay);
    }

    // Add start marker (green pin)
    overlays.push(`pin-l-s+22c55e(${start.longitude},${start.latitude})`);

    // Add end marker (blue pin)
    if (filteredLocations.length > 1) {
        overlays.push(`pin-l-e+3b82f6(${end.longitude},${end.latitude})`);
    }

    // Join overlays with comma
    const overlayString = overlays.join(',');

    // Calculate bounds for auto zoom
    // Use 'auto' for automatic bounding box
    const bounds = 'auto';

    // Build URL with @2x for retina display
    const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlayString}/${bounds}/${width}x${height}@2x?access_token=${MAPBOX_TOKEN}&padding=40`;

    return url;
}

/**
 * Get Mapbox access token
 */
export function getMapboxToken(): string {
    return MAPBOX_TOKEN;
}
