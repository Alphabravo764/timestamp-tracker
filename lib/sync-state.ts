import { create } from "zustand";

export type SyncStatus = "idle" | "syncing" | "success" | "error";

interface SyncState {
  photoSyncStatus: SyncStatus;
  locationSyncStatus: SyncStatus;
  lastPhotoSyncMessage: string;
  lastLocationSyncMessage: string;
  
  setPhotoSyncStatus: (status: SyncStatus, message?: string) => void;
  setLocationSyncStatus: (status: SyncStatus, message?: string) => void;
  resetSyncStatus: () => void;
}

/**
 * Sync State Manager
 * 
 * Tracks the sync status of photos and locations to the server.
 * Used by SyncStatusIndicator to show visual feedback to users.
 */
export const useSyncState = create<SyncState>((set) => ({
  photoSyncStatus: "idle",
  locationSyncStatus: "idle",
  lastPhotoSyncMessage: "",
  lastLocationSyncMessage: "",
  
  setPhotoSyncStatus: (status, message = "") =>
    set({ photoSyncStatus: status, lastPhotoSyncMessage: message }),
  
  setLocationSyncStatus: (status, message = "") =>
    set({ locationSyncStatus: status, lastLocationSyncMessage: message }),
  
  resetSyncStatus: () =>
    set({
      photoSyncStatus: "idle",
      locationSyncStatus: "idle",
      lastPhotoSyncMessage: "",
      lastLocationSyncMessage: "",
    }),
}));
