import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Shift } from "./shift-types";

const SYNC_QUEUE_KEY = "@timestamp_camera_sync_queue";
const OFFLINE_SHIFTS_KEY = "@timestamp_camera_offline_shifts";
const LAST_SYNC_KEY = "@timestamp_camera_last_sync";

export interface SyncQueueItem {
  id: string;
  type: "shift_created" | "shift_updated" | "shift_completed" | "photo_added";
  data: any;
  timestamp: string;
  retries: number;
}

export interface OfflineState {
  isOnline: boolean;
  lastSync: string | null;
  pendingItems: number;
}

// Check internet connectivity
export const isOnline = async (): Promise<boolean> => {
  try {
    const response = await fetch("https://www.google.com", { method: "HEAD", mode: "no-cors" });
    return response.ok || response.type === "opaque";
  } catch (error) {
    console.error("Error checking connectivity:", error);
    return false;
  }
};

// Add item to sync queue
export const addToSyncQueue = async (item: Omit<SyncQueueItem, "id" | "timestamp" | "retries">): Promise<void> => {
  try {
    const queue = await getSyncQueue();
    const newItem: SyncQueueItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      retries: 0,
    };
    
    queue.push(newItem);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    console.log("Added to sync queue:", newItem.id);
  } catch (error) {
    console.error("Error adding to sync queue:", error);
  }
};

// Get sync queue
export const getSyncQueue = async (): Promise<SyncQueueItem[]> => {
  try {
    const json = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error("Error getting sync queue:", error);
    return [];
  }
};

// Remove item from sync queue
export const removeFromSyncQueue = async (itemId: string): Promise<void> => {
  try {
    const queue = await getSyncQueue();
    const filtered = queue.filter(item => item.id !== itemId);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Error removing from sync queue:", error);
  }
};

// Update sync queue item retries
export const incrementSyncRetries = async (itemId: string): Promise<void> => {
  try {
    const queue = await getSyncQueue();
    const item = queue.find(i => i.id === itemId);
    if (item) {
      item.retries += 1;
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (error) {
    console.error("Error incrementing retries:", error);
  }
};

// Cache shift data for offline access
export const cacheShiftOffline = async (shift: Shift): Promise<void> => {
  try {
    const cached = await getOfflineShifts();
    const index = cached.findIndex(s => s.id === shift.id);
    
    if (index >= 0) {
      cached[index] = shift;
    } else {
      cached.push(shift);
    }
    
    await AsyncStorage.setItem(OFFLINE_SHIFTS_KEY, JSON.stringify(cached));
    console.log("Cached shift offline:", shift.id);
  } catch (error) {
    console.error("Error caching shift:", error);
  }
};

// Get offline cached shifts
export const getOfflineShifts = async (): Promise<Shift[]> => {
  try {
    const json = await AsyncStorage.getItem(OFFLINE_SHIFTS_KEY);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error("Error getting offline shifts:", error);
    return [];
  }
};

// Clear offline cache
export const clearOfflineCache = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(OFFLINE_SHIFTS_KEY);
    console.log("Cleared offline cache");
  } catch (error) {
    console.error("Error clearing cache:", error);
  }
};

// Update last sync time
export const updateLastSync = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  } catch (error) {
    console.error("Error updating last sync:", error);
  }
};

// Get last sync time
export const getLastSync = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(LAST_SYNC_KEY);
  } catch (error) {
    console.error("Error getting last sync:", error);
    return null;
  }
};

// Get offline state
export const getOfflineState = async (): Promise<OfflineState> => {
  try {
    const online = await isOnline();
    const lastSync = await getLastSync();
    const queue = await getSyncQueue();
    
    return {
      isOnline: online,
      lastSync,
      pendingItems: queue.length,
    };
  } catch (error) {
    console.error("Error getting offline state:", error);
    return {
      isOnline: false,
      lastSync: null,
      pendingItems: 0,
    };
  }
};

// Process sync queue (call when online)
export const processSyncQueue = async (): Promise<{ success: number; failed: number }> => {
  try {
    const queue = await getSyncQueue();
    let success = 0;
    let failed = 0;
    
    for (const item of queue) {
      try {
        // In a real app, you would send this to your backend here
        // For now, we just remove it from the queue
        await removeFromSyncQueue(item.id);
        success++;
        console.log("Synced:", item.id);
      } catch (error) {
        console.error("Error syncing item:", item.id, error);
        await incrementSyncRetries(item.id);
        failed++;
      }
    }
    
    if (success > 0) {
      await updateLastSync();
    }
    
    return { success, failed };
  } catch (error) {
    console.error("Error processing sync queue:", error);
    return { success: 0, failed: 0 };
  }
};
