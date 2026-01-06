import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  shifts,
  locationPoints,
  photoEvents,
  pairings,
  pdfReports,
  type InsertShift,
  type InsertLocationPoint,
  type InsertPhotoEvent,
  type InsertPairing,
  type InsertPdfReport,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== User Operations =====

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0] || null;
}

export async function updateUserProfile(
  userId: number,
  data: { name?: string; phone?: string; profilePhotoUrl?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set(data).where(eq(users.id, userId));
}

// ===== Shift Operations =====

export async function createShift(data: InsertShift) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(shifts).values(data);
  return Number(result[0].insertId);
}

export async function getShiftById(shiftId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(shifts).where(eq(shifts.id, shiftId)).limit(1);
  return result[0] || null;
}

export async function getShiftByToken(token: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(shifts).where(eq(shifts.liveToken, token)).limit(1);
  return result[0] || null;
}

export async function getShiftByPairCode(pairCode: string) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.pairCode, pairCode), eq(shifts.status, "active")))
    .limit(1);
  return result[0] || null;
}

export async function getUserShifts(userId: number, limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(shifts)
    .where(eq(shifts.userId, userId))
    .orderBy(desc(shifts.startTimeUtc))
    .limit(limit);
}

export async function getActiveShift(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.userId, userId), eq(shifts.status, "active")))
    .limit(1);
  return result[0] || null;
}

export async function updateShift(shiftId: number, data: Partial<InsertShift>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(shifts).set(data).where(eq(shifts.id, shiftId));
}

export async function endShift(shiftId: number, endTimeUtc: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const shift = await getShiftById(shiftId);
  if (!shift) throw new Error("Shift not found");

  const durationMinutes = Math.floor(
    (endTimeUtc.getTime() - new Date(shift.startTimeUtc).getTime()) / 60000
  );

  await db
    .update(shifts)
    .set({
      status: "completed",
      endTimeUtc,
      durationMinutes,
    })
    .where(eq(shifts.id, shiftId));
}

// ===== Location Operations =====

export async function addLocationPoints(points: InsertLocationPoint[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (points.length === 0) return;
  await db.insert(locationPoints).values(points);
}

export async function getShiftLocations(shiftId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(locationPoints)
    .where(eq(locationPoints.shiftId, shiftId))
    .orderBy(locationPoints.capturedAt);
}

export async function getLatestLocation(shiftId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(locationPoints)
    .where(eq(locationPoints.shiftId, shiftId))
    .orderBy(desc(locationPoints.capturedAt))
    .limit(1);
  return result[0] || null;
}

// ===== Photo Operations =====

export async function addPhotoEvent(data: InsertPhotoEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(photoEvents).values(data);
  return Number(result[0].insertId);
}

export async function getShiftPhotos(shiftId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(photoEvents)
    .where(eq(photoEvents.shiftId, shiftId))
    .orderBy(photoEvents.capturedAt);
}

// ===== Pairing Operations =====

export async function createPairing(data: InsertPairing) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(pairings).values(data);
  return Number(result[0].insertId);
}

export async function getUserPairings(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(pairings)
    .where(and(eq(pairings.userId, userId), eq(pairings.status, "active")))
    .orderBy(desc(pairings.createdAt));
}

export async function getCompanyPairings(companyId: number) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(pairings)
    .where(and(eq(pairings.companyId, companyId), eq(pairings.status, "active")))
    .orderBy(desc(pairings.createdAt));
}

// ===== PDF Report Operations =====

export async function createPdfReport(data: InsertPdfReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(pdfReports).values(data);
  return Number(result[0].insertId);
}

export async function getShiftPdfReport(shiftId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(pdfReports)
    .where(eq(pdfReports.shiftId, shiftId))
    .orderBy(desc(pdfReports.generatedAt))
    .limit(1);
  return result[0] || null;
}

// ===== Helper Functions =====

export function generateToken(length: number = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function generatePairCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude similar characters
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${code.slice(0, 3)}-${code.slice(3, 6)}`;
}

// ===== Premium Code Operations =====

import { premiumCodes } from "../drizzle/schema";

export async function validatePremiumCode(code: string) {
  const db = await getDb();
  if (!db) return { valid: false, error: "Database not available" };

  const normalizedCode = code.trim().toUpperCase();

  const result = await db
    .select()
    .from(premiumCodes)
    .where(eq(premiumCodes.code, normalizedCode))
    .limit(1);

  if (result.length === 0) {
    return { valid: false, error: "Invalid code" };
  }

  const codeRecord = result[0];

  if (codeRecord.isUsed) {
    return { valid: false, error: "Code already been used" };
  }

  return {
    valid: true,
    limits: {
      shifts: codeRecord.shiftsLimit,
      reports: codeRecord.reportsLimit,
      liveShares: codeRecord.liveSharesLimit,
    }
  };
}

export async function redeemPremiumCode(code: string, deviceId: string) {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  const validation = await validatePremiumCode(code);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const normalizedCode = code.trim().toUpperCase();

  await db
    .update(premiumCodes)
    .set({
      isUsed: true,
      usedByDeviceId: deviceId,
      usedAt: new Date(),
    })
    .where(eq(premiumCodes.code, normalizedCode));

  return {
    success: true,
    limits: validation.limits
  };
}

// Generate 20 premium codes (run once to seed database)
export async function generatePremiumCodes() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const codes: string[] = [];
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  for (let i = 0; i < 20; i++) {
    let code = "STAMPIA-";
    for (let j = 0; j < 8; j++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    codes.push(code);
  }

  // Insert all codes
  for (const code of codes) {
    try {
      await db.insert(premiumCodes).values({
        code,
        isUsed: false,
        shiftsLimit: 60,
        liveSharesLimit: 60,
        reportsLimit: 60,
      });
    } catch (e) {
      // Skip if code already exists
    }
  }

  return codes;
}
