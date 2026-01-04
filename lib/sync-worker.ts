/**
 * Sync Worker - automatically retries failed uploads from the queue
 * Runs in background and processes queue items when network is available
 */

import { getRetryableItems, removeFromSyncQueue, updateAttempt } from "./sync-queue";
import { syncPhoto } from "./server-sync";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

let isProcessing = false;

/**
 * Process sync queue - retry failed uploads
 */
export async function processSyncQueue(): Promise<void> {
  if (isProcessing) {
    console.log("[Sync Worker] Already processing, skipping...");
    return;
  }

  isProcessing = true;
  console.log("[Sync Worker] Starting queue processing...");

  try {
    const items = await getRetryableItems();
    console.log(`[Sync Worker] Found ${items.length} items to retry`);

    for (const item of items) {
      try {
        console.log(`[Sync Worker] Retrying ${item.type} (attempt ${item.attempts + 1})...`);

        if (item.type === "photo") {
          // Compress and upload photo
          let photoDataUri = item.data.photoUri;

          if (Platform.OS !== "web" && photoDataUri.startsWith("file://")) {
            const { manipulateAsync, SaveFormat } = await import("expo-image-manipulator");

            // Compress
            const compressed = await manipulateAsync(
              photoDataUri,
              [{ resize: { width: 1920 } }],
              { compress: 0.7, format: SaveFormat.JPEG }
            );

            // Convert to base64
            const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            photoDataUri = `data:image/jpeg;base64,${base64}`;
          }

          const result = await syncPhoto({
            shiftId: item.data.shiftId,
            pairCode: item.data.pairCode,
            photoUri: photoDataUri,
            latitude: item.data.latitude,
            longitude: item.data.longitude,
            address: item.data.address,
            timestamp: item.data.timestamp,
          });

          if (result.photoUrl) {
            console.log(`[Sync Worker] ✓ Success:`, result.photoUrl);
            await removeFromSyncQueue(item.id);
          } else {
            throw new Error("No photo URL returned");
          }
        }
      } catch (error) {
        console.log(`[Sync Worker] Retry failed for ${item.id}:`, error);
        await updateAttempt(item.id);
      }
    }

    console.log("[Sync Worker] Queue processing complete");
  } catch (error) {
    console.error("[Sync Worker] Queue processing error:", error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Start auto-retry worker (call on app start)
 * Processes queue every 30 seconds
 */
export function startSyncWorker(): void {
  console.log("[Sync Worker] Started");

  // Process immediately on start
  processSyncQueue();

  // Then process every 30 seconds
  setInterval(() => {
    processSyncQueue();
  }, 30000);
}
