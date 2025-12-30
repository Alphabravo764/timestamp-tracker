import type { LocationPoint, GeofenceArea } from "./shift-types";

/**
 * Calculate distance between two coordinates in meters using Haversine formula
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Check if a location is inside a geofence
 */
export const isInsideGeofence = (
  location: LocationPoint,
  geofence: GeofenceArea
): boolean => {
  const distance = calculateDistance(
    location.latitude,
    location.longitude,
    geofence.latitude,
    geofence.longitude
  );
  return distance <= geofence.radiusMeters;
};

/**
 * Check if location left geofence (was inside, now outside)
 */
export const hasLeftGeofence = (
  previousLocation: LocationPoint | null,
  currentLocation: LocationPoint,
  geofence: GeofenceArea
): boolean => {
  if (!previousLocation) return false;

  const wasInside = isInsideGeofence(previousLocation, geofence);
  const isNowInside = isInsideGeofence(currentLocation, geofence);

  return wasInside && !isNowInside;
};

/**
 * Check if location entered geofence (was outside, now inside)
 */
export const hasEnteredGeofence = (
  previousLocation: LocationPoint | null,
  currentLocation: LocationPoint,
  geofence: GeofenceArea
): boolean => {
  if (!previousLocation) return false;

  const wasInside = isInsideGeofence(previousLocation, geofence);
  const isNowInside = isInsideGeofence(currentLocation, geofence);

  return !wasInside && isNowInside;
};

/**
 * Generate alert message for geofence event
 */
export const generateGeofenceAlert = (
  staffName: string,
  geofence: GeofenceArea,
  eventType: "left" | "entered"
): string => {
  const time = new Date().toLocaleTimeString();
  const area = geofence.name || "work area";

  if (eventType === "left") {
    return `⚠️ ${staffName} left ${area} at ${time}`;
  } else {
    return `✓ ${staffName} entered ${area} at ${time}`;
  }
};

/**
 * Create a geofence from two locations (bounding box)
 */
export const createGeofenceFromLocations = (
  locations: LocationPoint[],
  radiusMeters: number = 500
): GeofenceArea | null => {
  if (locations.length === 0) return null;

  // Calculate center point
  const avgLat = locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length;
  const avgLon = locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length;

  return {
    latitude: avgLat,
    longitude: avgLon,
    radiusMeters,
    name: "Work Area",
  };
};
