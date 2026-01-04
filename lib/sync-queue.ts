/**
 * Sync Queue Manager - handles retry logic for failed uploads
 * Stores failed uploads in AsyncStorage and retries when network returns
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SyncQueueItem {
  id: string;
  type: "photo" | "location" | "note";
  data: any;
  attempts: number;
  lastAttempt: string;
  createdAt: string;
}

const QUEUE_KEY = "@sync_queue";
const MAX_ATTEMPTS = 5;

/**
 * Add item to sync queue
 */
export async function addToSyncQueue(item: Omit<SyncQueueItem, "id" | "attempts" | "lastAttempt" | "createdAt">): Promise<void> {
  try {
    const queue = await getSyncQueue();
    const newItem: SyncQueueItem = {
      ...item,
      id: Date.now().toString(),
      attempts: 0,
      lastAttempt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    
    queue.push(newItem);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    console.log("[Sync Queue] Added item:", newItem.id, newItem.type);
  } catch (error) {
    console.error("[Sync Queue] Failed to add item:", error);
  }
}

/**
 * Get all items in sync queue
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  try {
    const data = await AsyncStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("[Sync Queue] Failed to get queue:", error);
    return [];
  }
}

/**
 * Remove item from sync queue
 */
export async function removeFromSyncQueue(itemId: string): Promise<void> {
  try {
    const queue = await getSyncQueue();
    const filtered = queue.filter(item => item.id !== itemId);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
    console.log("[Sync Queue] Removed item:", itemId);
  } catch (error) {
    console.error("[Sync Queue] Failed to remove item:", error);
  }
}

/**
 * Update item attempt count
 */
export async function updateAttempt(itemId: string): Promise<void> {
  try {
    const queue = await getSyncQueue();
    const item = queue.find(i => i.id === itemId);
    
    if (item) {
      item.attempts += 1;
      item.lastAttempt = new Date().toISOString();
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (error) {
    console.error("[Sync Queue] Failed to update attempt:", error);
  }
}

/**
 * Get items that need retry (not exceeded max attempts)
 */
export async function getRetryableItems(): Promise<SyncQueueItem[]> {
  const queue = await getSyncQueue();
  return queue.filter(item => item.attempts < MAX_ATTEMPTS);
}

/**
 * Clear entire sync queue
 */
export async function clearSyncQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUEUE_KEY);
    console.log("[Sync Queue] Cleared");
  } catch (error) {
    console.error("[Sync Queue] Failed to clear:", error);
  }
}

/**
 * Get queue statistics
 */
export async function getSyncQueueStats(): Promise<{ total: number; pending: number; failed: number }> {
  const queue = await getSyncQueue();
  return {
    total: queue.length,
    pending: queue.filter(item => item.attempts < MAX_ATTEMPTS).length,
    failed: queue.filter(item => item.attempts >= MAX_ATTEMPTS).length,
  };
}
