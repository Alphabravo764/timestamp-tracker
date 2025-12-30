/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

// Shared types for shift and location data
export type ShiftStatus = "active" | "completed" | "cancelled";
export type PhotoType = "start" | "mid" | "end";
export type LocationSource = "gps" | "network" | "mock";

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  timestamp: number;
}

export interface PhotoData {
  id?: number;
  shiftId: number;
  fileUrl: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  photoType: PhotoType;
  capturedAt: Date;
}

export interface ShiftData {
  id: number;
  userId: number;
  siteName: string;
  notes?: string;
  status: ShiftStatus;
  startTimeUtc: Date;
  endTimeUtc?: Date;
  durationMinutes?: number;
  liveToken: string;
  pairCode?: string;
  pairCodeExpiresAt?: Date;
}
