/**
 * Database helpers for live shift synchronization
 * Replaces in-memory storage with persistent database storage
 */

import { eq, and, desc } from "drizzle-orm";
import { getDb } from "./db.js";
import { shifts, locationPoints, photoEvents, noteEvents, type InsertShift, type InsertLocationPoint, type InsertPhotoEvent, type InsertNoteEvent, type LocationPoint, type PhotoEvent, type NoteEvent } from "../drizzle/schema.js";

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;
    // Try a simple query
    await db.select().from(shifts).limit(1);
    return true;
  } catch (error) {
    console.error("[sync-db] Connection test failed:", error);
    return false;
  }
}

/**
 * Create or update a shift in the database
 */
export async function upsertShift(data: {
  pairCode: string;
  shiftId: string;
  staffName?: string;
  siteName: string;
  startTime: string;
  userId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Normalize pairCode: uppercase, no hyphens (matches client format)
  const normalizedCode = data.pairCode.toUpperCase().replace(/-/g, '');
  console.log('[sync-db] upsertShift with code:', normalizedCode);

  // Check if shift exists
  const existing = await db
    .select()
    .from(shifts)
    .where(eq(shifts.pairCode, normalizedCode))
    .limit(1);

  if (existing.length > 0) {
    // Update existing shift
    await db
      .update(shifts)
      .set({
        staffName: data.staffName,
        siteName: data.siteName,
        updatedAt: new Date(),
      })
      .where(eq(shifts.pairCode, normalizedCode));
    return existing[0];
  } else {
    // Create new shift
    const result = await db.insert(shifts).values({
      userId: data.userId || 0, // Default to 0 for anonymous shifts
      staffName: data.staffName,
      siteName: data.siteName,
      status: "active",
      startTimeUtc: new Date(data.startTime),
      liveToken: data.shiftId,
      pairCode: normalizedCode,
      pairCodeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // Get the created shift
    const created = await db
      .select()
      .from(shifts)
      .where(eq(shifts.pairCode, normalizedCode))
      .limit(1);

    return created[0];
  }
}

/**
 * Add a location point to a shift
 */
export async function addLocationPoint(data: {
  pairCode: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  address?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Find shift by pair code
  const shift = await db
    .select()
    .from(shifts)
    .where(eq(shifts.pairCode, data.pairCode))
    .limit(1);

  if (shift.length === 0) {
    throw new Error("Shift not found");
  }

  // Insert location point
  await db.insert(locationPoints).values({
    shiftId: shift[0].id,
    latitude: data.latitude.toString(),
    longitude: data.longitude.toString(),
    accuracy: data.accuracy?.toString(),
    capturedAt: new Date(data.timestamp),
    source: "gps",
  });

  return { success: true };
}

/**
 * Add a photo to a shift
 */
export async function addPhoto(data: {
  pairCode: string;
  photoUri: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  timestamp: string;
  address?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Find shift by pair code
  const shift = await db
    .select()
    .from(shifts)
    .where(eq(shifts.pairCode, data.pairCode))
    .limit(1);

  if (shift.length === 0) {
    throw new Error("Shift not found");
  }

  // Insert photo event
  await db.insert(photoEvents).values({
    shiftId: shift[0].id,
    fileUrl: data.photoUri,
    latitude: data.latitude?.toString(),
    longitude: data.longitude?.toString(),
    accuracy: data.accuracy?.toString(),
    photoType: "mid",
    capturedAt: new Date(data.timestamp),
  });

  return { success: true };
}

/**
 * Add a note to a shift
 */
export async function addNote(data: {
  pairCode: string;
  noteId: string;
  text: string;
  timestamp: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get shift by pair code
  const shift = await db
    .select()
    .from(shifts)
    .where(eq(shifts.pairCode, data.pairCode))
    .limit(1);

  if (shift.length === 0) {
    throw new Error("Shift not found");
  }

  const shiftId = shift[0].id;

  // Insert note
  await db.insert(noteEvents).values({
    shiftId,
    noteText: data.text,
    latitude: data.latitude ? data.latitude.toString() : null,
    longitude: data.longitude ? data.longitude.toString() : null,
    accuracy: data.accuracy ? data.accuracy.toString() : null,
    capturedAt: new Date(data.timestamp),
  });

  console.log(`[sync-db] Note added to shift ${shiftId}`);
}

/**
 * End a shift
 */
export async function endShift(data: {
  pairCode: string;
  endTime: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const endTimeUtc = new Date(data.endTime);

  // Get shift to calculate duration
  const shift = await db
    .select()
    .from(shifts)
    .where(eq(shifts.pairCode, data.pairCode))
    .limit(1);

  if (shift.length === 0) {
    throw new Error("Shift not found");
  }

  const durationMs = endTimeUtc.getTime() - shift[0].startTimeUtc.getTime();
  const durationMinutes = Math.floor(durationMs / 60000);

  // Update shift status
  await db
    .update(shifts)
    .set({
      status: "completed",
      endTimeUtc,
      durationMinutes,
      updatedAt: new Date(),
    })
    .where(eq(shifts.pairCode, data.pairCode));

  return { success: true };
}

/**
 * Get shift data by pair code (for live viewer)
 */
export async function getShiftByPairCode(pairCode: string) {
  const db = await getDb();
  if (!db) return null;

  // Normalize pairCode: uppercase, no hyphens (matches client and upsert format)
  const normalizedCode = pairCode.toUpperCase().replace(/-/g, '');
  console.log('[sync-db] getShiftByPairCode looking for:', normalizedCode);

  // Get shift
  const shiftData = await db
    .select()
    .from(shifts)
    .where(eq(shifts.pairCode, normalizedCode))
    .limit(1);

  if (shiftData.length === 0) {
    console.log('[sync-db] Shift not found for code:', normalizedCode);
    return null;
  }

  const shift = shiftData[0];

  // Get locations
  const locations: LocationPoint[] = await db
    .select()
    .from(locationPoints)
    .where(eq(locationPoints.shiftId, shift.id))
    .orderBy(locationPoints.capturedAt);

  // Get photos
  const photos: PhotoEvent[] = await db
    .select()
    .from(photoEvents)
    .where(eq(photoEvents.shiftId, shift.id))
    .orderBy(photoEvents.capturedAt);

  // Get notes
  const notes: NoteEvent[] = await db
    .select()
    .from(noteEvents)
    .where(eq(noteEvents.shiftId, shift.id))
    .orderBy(noteEvents.capturedAt);

  // Transform to expected format
  return {
    id: shift.liveToken,
    shiftId: shift.liveToken,
    pairCode: shift.pairCode,
    siteName: shift.siteName,
    staffName: shift.staffName || "Staff",
    startTime: shift.startTimeUtc.toISOString(),
    endTime: shift.endTimeUtc?.toISOString(),
    isActive: shift.status === "active",
    locations: locations.map((loc: LocationPoint) => ({
      latitude: parseFloat(loc.latitude),
      longitude: parseFloat(loc.longitude),
      accuracy: loc.accuracy ? parseFloat(loc.accuracy) : undefined,
      timestamp: loc.capturedAt.toISOString(),
      address: undefined, // Address not stored in DB yet
    })),
    photos: photos.map((photo: PhotoEvent) => ({
      id: photo.id.toString(),
      photoUri: photo.fileUrl,
      latitude: photo.latitude ? parseFloat(photo.latitude) : undefined,
      longitude: photo.longitude ? parseFloat(photo.longitude) : undefined,
      timestamp: photo.capturedAt.toISOString(),
      address: undefined, // Address not stored in DB yet
    })),
    notes: notes.map((note: NoteEvent) => ({
      id: note.id.toString(),
      text: note.noteText,
      timestamp: note.capturedAt.toISOString(),
      location: note.latitude && note.longitude ? {
        latitude: parseFloat(note.latitude),
        longitude: parseFloat(note.longitude),
        accuracy: note.accuracy ? parseFloat(note.accuracy) : undefined,
      } : undefined,
    })),
    lastUpdated: shift.updatedAt.toISOString(),
  };
}
