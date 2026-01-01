// Google Maps utilities for geocoding and static map generation

// Get API key from environment (for server-side) or hardcode for client
const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env?.GOOGLE_MAPS_API_KEY) {
    return process.env.GOOGLE_MAPS_API_KEY;
  }
  // For client-side, we'll use the key directly (it's restricted by domain)
  return "AIzaSyAcO73jwR7aKMIeJitYQgfLWRxbgCmbsps";
};

export interface GeocodingResult {
  address: string;
  street: string;
  postcode: string;
  city: string;
  country: string;
}

/**
 * Reverse geocode coordinates to get address
 */
export async function reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
  try {
    const apiKey = getApiKey();
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    );
    
    const data = await response.json();
    
    if (data.status !== "OK" || !data.results?.[0]) {
      return null;
    }

    const result = data.results[0];
    const components = result.address_components || [];
    
    let street = "";
    let postcode = "";
    let city = "";
    let country = "";
    let streetNumber = "";
    let route = "";

    for (const comp of components) {
      const types = comp.types || [];
      if (types.includes("street_number")) streetNumber = comp.long_name;
      if (types.includes("route")) route = comp.long_name;
      if (types.includes("postal_code")) postcode = comp.long_name;
      if (types.includes("locality") || types.includes("postal_town")) city = comp.long_name;
      if (types.includes("country")) country = comp.long_name;
    }

    street = streetNumber ? `${streetNumber} ${route}` : route;

    return {
      address: result.formatted_address || "",
      street: street || "",
      postcode: postcode || "",
      city: city || "",
      country: country || "",
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

/**
 * Format address for display on photos
 */
export function formatAddressForDisplay(geo: GeocodingResult | null): string {
  if (!geo) return "";
  
  const parts: string[] = [];
  if (geo.street) parts.push(geo.street);
  if (geo.city) parts.push(geo.city);
  if (geo.postcode) parts.push(geo.postcode);
  
  return parts.join(", ");
}

/**
 * Generate Google Static Maps URL with trail polyline
 */
export function generateStaticMapUrl(
  locations: { latitude: number; longitude: number }[],
  width: number = 600,
  height: number = 400
): string {
  const apiKey = getApiKey();
  
  if (locations.length === 0) {
    return "";
  }

  // Base URL
  let url = `https://maps.googleapis.com/maps/api/staticmap?size=${width}x${height}&maptype=roadmap`;

  // Add markers for start (green) and end (red)
  const start = locations[0];
  const end = locations[locations.length - 1];
  
  url += `&markers=color:green|label:S|${start.latitude},${start.longitude}`;
  
  if (locations.length > 1) {
    url += `&markers=color:red|label:E|${end.latitude},${end.longitude}`;
  }

  // Add polyline path if we have multiple points
  if (locations.length > 1) {
    // Encode the path - Google expects lat,lng pairs separated by |
    const pathPoints = locations.map(loc => `${loc.latitude},${loc.longitude}`).join("|");
    url += `&path=color:0x0a7ea4ff|weight:4|${pathPoints}`;
  }

  url += `&key=${apiKey}`;
  
  return url;
}

/**
 * Generate encoded polyline for Google Maps (for longer trails)
 */
export function encodePolyline(locations: { latitude: number; longitude: number }[]): string {
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
 * Filter GPS points to remove jitter and bad accuracy readings
 */
function filterGpsPoints(locations: { latitude: number; longitude: number; accuracy?: number }[]): { latitude: number; longitude: number }[] {
  if (locations.length <= 2) return locations;
  
  const filtered: { latitude: number; longitude: number }[] = [];
  let lastPoint: { latitude: number; longitude: number } | null = null;
  
  for (const loc of locations) {
    // Skip points with poor accuracy (>30m)
    if (loc.accuracy && loc.accuracy > 30) continue;
    
    if (!lastPoint) {
      filtered.push(loc);
      lastPoint = loc;
      continue;
    }
    
    // Calculate distance from last point
    const R = 6371000; // Earth's radius in meters
    const dLat = ((loc.latitude - lastPoint.latitude) * Math.PI) / 180;
    const dLon = ((loc.longitude - lastPoint.longitude) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((lastPoint.latitude * Math.PI) / 180) *
              Math.cos((loc.latitude * Math.PI) / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    // Only keep points that moved >5m (removes jitter)
    if (distance > 5) {
      filtered.push(loc);
      lastPoint = loc;
    }
  }
  
  // Always include the last point
  if (locations.length > 0 && filtered.length > 0) {
    const last = locations[locations.length - 1];
    const lastFiltered = filtered[filtered.length - 1];
    if (last.latitude !== lastFiltered.latitude || last.longitude !== lastFiltered.longitude) {
      filtered.push(last);
    }
  }
  
  return filtered;
}

/**
 * Generate Google Static Maps URL with encoded polyline (for long trails)
 * Improved quality: scale=2, larger size, thicker path, filtered GPS points
 */
export function generateStaticMapUrlEncoded(
  locations: { latitude: number; longitude: number; accuracy?: number }[],
  width: number = 600,
  height: number = 400
): string {
  const apiKey = getApiKey();
  
  if (locations.length === 0) {
    return "";
  }

  // Filter GPS points to remove jitter and bad readings
  const filteredLocations = filterGpsPoints(locations);
  
  const start = filteredLocations[0];
  const end = filteredLocations[filteredLocations.length - 1];
  const encodedPath = encodePolyline(filteredLocations);

  // Use larger size and scale=2 for high quality
  let url = `https://maps.googleapis.com/maps/api/staticmap?size=${width}x${height}&scale=2&maptype=roadmap`;
  
  // Use custom markers with better visibility
  url += `&markers=color:0x22C55E|label:S|${start.latitude},${start.longitude}`;
  
  if (filteredLocations.length > 1) {
    url += `&markers=color:0xEF4444|label:E|${end.latitude},${end.longitude}`;
    // Thicker path (weight:6) with better color
    url += `&path=color:0x0a7ea4ff|weight:6|enc:${encodedPath}`;
  }

  url += `&key=${apiKey}`;
  
  return url;
}

/**
 * Get Google Maps API key for client-side use
 */
export function getGoogleMapsApiKey(): string {
  return getApiKey();
}
