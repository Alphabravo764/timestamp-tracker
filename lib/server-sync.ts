/**
 * Server Sync Utility
 * Syncs shift data to the server for live viewing by watchers
 */

import { getApiBaseUrl } from "@/constants/oauth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SYNC_QUEUE_KEY = "@timestamp_sync_queue";

interface SyncItem {
  id: string;
  type: "shift_start" | "location" | "photo" | "note" | "shift_end";
  data: any;
  timestamp: string;
  retries: number;
}

/**
 * Add item to sync queue
 */
async function addToQueue(item: Omit<SyncItem, "id" | "timestamp" | "retries">) {
  try {
    const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    const queue: SyncItem[] = queueJson ? JSON.parse(queueJson) : [];
    
    queue.push({
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      retries: 0,
    });
    
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error("Failed to add to sync queue:", error);
  }
}

/**
 * Process sync queue
 */
async function processQueue() {
  try {
    const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    if (!queueJson) return;
    
    const queue: SyncItem[] = JSON.parse(queueJson);
    if (queue.length === 0) return;
    
    const remaining: SyncItem[] = [];
    
    for (const item of queue) {
      try {
        await syncItem(item);
      } catch (error) {
        if (item.retries < 3) {
          remaining.push({ ...item, retries: item.retries + 1 });
        }
      }
    }
    
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining));
  } catch (error) {
    console.error("Failed to process sync queue:", error);
  }
}

/**
 * Sync a single item to server
 */
async function syncItem(item: SyncItem) {
  const baseUrl = getApiBaseUrl();
  
  switch (item.type) {
    case "shift_start":
      await fetch(`${baseUrl}/api/sync/shift`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.data),
      });
      break;
      
    case "location":
      await fetch(`${baseUrl}/api/sync/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.data),
      });
      break;
      
    case "photo":
      await fetch(`${baseUrl}/api/sync/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.data),
      });
      break;
      
    case "note":
      await fetch(`${baseUrl}/api/sync/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.data),
      });
      break;
      
    case "shift_end":
      await fetch(`${baseUrl}/api/sync/shift-end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.data),
      });
      break;
  }
}

/**
 * Sync shift start to server
 */
export async function syncShiftStart(shift: {
  id: string;
  pairCode: string;
  staffName: string;
  siteName: string;
  startTime: string;
  startLocation?: { latitude: number; longitude: number; address?: string };
}) {
  await addToQueue({
    type: "shift_start",
    data: shift,
  });
  await processQueue();
}

/**
 * Sync location update to server
 */
export async function syncLocation(data: {
  shiftId: string;
  pairCode: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  timestamp: string;
}) {
  await addToQueue({
    type: "location",
    data,
  });
  await processQueue();
}

/**
 * Sync photo to server
 */
export async function syncPhoto(data: {
  shiftId: string;
  pairCode: string;
  photoUri: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  timestamp: string;
}) {
  await addToQueue({
    type: "photo",
    data,
  });
  await processQueue();
}

/**
 * Sync note to server
 */
export async function syncNote(data: {
  shiftId: string;
  pairCode: string;
  noteId: string;
  text: string;
  timestamp: string;
}) {
  await addToQueue({
    type: "note",
    data,
  });
  await processQueue();
}

/**
 * Sync shift end to server
 */
export async function syncShiftEnd(data: {
  shiftId: string;
  pairCode: string;
  endTime: string;
  endLocation?: { latitude: number; longitude: number; address?: string };
}) {
  await addToQueue({
    type: "shift_end",
    data,
  });
  await processQueue();
}

/**
 * Clear sync queue
 */
export async function clearSyncQueue() {
  await AsyncStorage.removeItem(SYNC_QUEUE_KEY);
}

/**
 * Get sync queue status
 */
export async function getSyncQueueStatus(): Promise<{ pending: number }> {
  try {
    const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    const queue: SyncItem[] = queueJson ? JSON.parse(queueJson) : [];
    return { pending: queue.length };
  } catch {
    return { pending: 0 };
  }
}
