/**
 * Safe coordinate helpers to prevent render crashes
 * from invalid/null/undefined latitude/longitude values
 */

/**
 * Check if a value is a finite number
 */
export const isFiniteNumber = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v);

/**
 * Safely convert a number to fixed decimal string
 * Returns "—" if value is not a valid number
 */
export const safeToFixed = (v: unknown, digits = 5): string =>
    isFiniteNumber(v) ? v.toFixed(digits) : "—";

/**
 * Check if latitude and longitude are valid coordinates
 */
export const hasValidCoords = (lat: unknown, lon: unknown): boolean =>
    isFiniteNumber(lat) &&
    isFiniteNumber(lon) &&
    Math.abs(lat as number) <= 90 &&
    Math.abs(lon as number) <= 180;

/**
 * Format coordinates safely for display
 * Returns null if coordinates are invalid
 */
export const formatCoords = (lat: unknown, lon: unknown): string | null => {
    if (!hasValidCoords(lat, lon)) return null;
    return `(${safeToFixed(lat, 5)}, ${safeToFixed(lon, 5)})`;
};
