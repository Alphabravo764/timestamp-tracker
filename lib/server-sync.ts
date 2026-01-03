// /lib/server-sync.ts
import { getApiBaseUrl } from "@/constants/oauth";

type ShiftStartPayload = {
  id: string;
  pairCode: string;
  staffName: string;
  siteName: string;
  startTime: string;
  startLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
};

type LocationPayload = {
  pairCode: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  address?: string;
};

type PhotoPayload = {
  pairCode: string;
  photoUrl: string;
  latitude?: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  address?: string;
};

type NotePayload = {
  pairCode: string;
  note: string;
  timestamp: string;
};

type ShiftEndPayload = {
  pairCode: string;
  endTime: string;
};

/**
 * Generic POST helper with timeout and loud logging
 */
async function postJson<T>(path: string, body: any, timeoutMs = 15000): Promise<T> {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  console.log("[server-sync] POST", url);
  console.log("[server-sync] body", JSON.stringify(body, null, 2));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    console.log("[server-sync] status", res.status);
    console.log("[server-sync] response", text);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error("[server-sync] TIMEOUT after", timeoutMs, "ms");
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    console.error("[server-sync] NETWORK ERROR:", error);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Sync shift start to server
 */
export async function syncShiftStart(payload: ShiftStartPayload) {
  return postJson<{ success: boolean }>("/api/sync/shift", {
    pairCode: payload.pairCode,
    shiftId: payload.id,
    staffName: payload.staffName,
    siteName: payload.siteName,
    startTime: payload.startTime,
  });
}

/**
 * Sync location update to server
 */
export async function syncLocation(payload: LocationPayload) {
  return postJson<{ success: boolean }>("/api/sync/location", payload);
}

/**
 * Sync photo to server
 */
export async function syncPhoto(payload: PhotoPayload) {
  return postJson<{ success: boolean }>("/api/sync/photo", payload);
}

/**
 * Sync note to server
 */
export async function syncNote(payload: NotePayload) {
  return postJson<{ success: boolean }>("/api/sync/note", payload);
}

/**
 * Sync shift end to server
 */
export async function syncShiftEnd(payload: ShiftEndPayload) {
  return postJson<{ success: boolean }>("/api/sync/shift-end", payload);
}
