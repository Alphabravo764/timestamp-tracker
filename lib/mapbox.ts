/**
 * Mapbox utilities for static maps and geocoding
 */

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

if (!MAPBOX_TOKEN) {
    // Mobile app doesn't need Mapbox token - maps are rendered server-side
    console.warn('[Mapbox] Token not set (OK for mobile app, required for server)');
}

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

    // Filter out invalid points
    let filteredLocations = locations.filter(loc =>
        loc.latitude && loc.longitude &&
        Math.abs(loc.latitude) <= 90 && Math.abs(loc.longitude) <= 180 &&
        (!loc.accuracy || loc.accuracy < 100)
    );

    if (filteredLocations.length === 0) {
        filteredLocations = locations.filter(loc => loc.latitude && loc.longitude);
    }

    if (filteredLocations.length === 0) {
        return "";
    }

    const start = filteredLocations[0];
    const end = filteredLocations[filteredLocations.length - 1];

    // Build overlays array
    const overlays: string[] = [];

    // Add polyline path if we have multiple points - use GeoJSON format which is more reliable
    if (filteredLocations.length > 1) {
        // Sample points if too many (Mapbox URL length limit)
        const maxPoints = 50;
        const step = Math.max(1, Math.floor(filteredLocations.length / maxPoints));
        const sampledLocations = filteredLocations.filter((_, i) => i % step === 0 || i === filteredLocations.length - 1);

        // Build path as coordinate pairs - simpler and more reliable
        const pathCoords = sampledLocations.map(loc => `[${loc.longitude.toFixed(5)},${loc.latitude.toFixed(5)}]`).join(',');

        // Use geojson overlay format for polyline
        const geoJson = encodeURIComponent(JSON.stringify({
            "type": "Feature",
            "properties": { "stroke": "#3b82f6", "stroke-width": 4, "stroke-opacity": 0.8 },
            "geometry": {
                "type": "LineString",
                "coordinates": sampledLocations.map(loc => [loc.longitude, loc.latitude])
            }
        }));

        overlays.push(`geojson(${geoJson})`);
    }

    // Add start marker (green pin)
    overlays.push(`pin-l-s+22c55e(${start.longitude.toFixed(5)},${start.latitude.toFixed(5)})`);

    // Add end marker (red pin) if different from start
    if (filteredLocations.length > 1) {
        overlays.push(`pin-l-e+ef4444(${end.longitude.toFixed(5)},${end.latitude.toFixed(5)})`);
    }

    // Join overlays with comma
    const overlayString = overlays.join(',');

    // Build URL with auto bounds and padding
    const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlayString}/auto/${width}x${height}@2x?access_token=${MAPBOX_TOKEN}&padding=50`;

    return url;
}

/**
 * Get Mapbox access token
 */
export function getMapboxToken(): string {
    return MAPBOX_TOKEN;
}

/**
 * Alias for reverseGeocodeMapbox - returns formatted address string
 */
export async function mapboxReverseGeocode(lat: number, lng: number): Promise<string> {
    const result = await reverseGeocodeMapbox(lat, lng);
    if (result) {
        return formatMapboxAddress(result);
    }
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
