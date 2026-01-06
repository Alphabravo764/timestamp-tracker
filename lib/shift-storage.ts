import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import type { Shift, ShiftPhoto, LocationPoint } from "./shift-types";

const ACTIVE_SHIFT_KEY = "@timestamp_camera_active_shift";
const SHIFT_HISTORY_KEY = "@timestamp_camera_shift_history";

// Generate 6-character pair code
export const generatePairCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Get active shift
export const getActiveShift = async (): Promise<Shift | null> => {
  try {
    const json = await AsyncStorage.getItem(ACTIVE_SHIFT_KEY);
    if (!json) return null;
    const shift = JSON.parse(json);
    return shift;
  } catch (error) {
    console.error("Error getting active shift:", error);
    return null;
  }
};

// Start a new shift
export const startShift = async (
  staffName: string,
  siteName: string,
  location: LocationPoint
): Promise<Shift> => {
  try {
    // Clear any existing active shift first
    await AsyncStorage.removeItem(ACTIVE_SHIFT_KEY);

    const shift: Shift = {
      id: `shift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      staffName: staffName || "Staff",
      siteName: siteName || "Unknown Site",
      pairCode: generatePairCode(),
      startTime: new Date().toISOString(),
      endTime: null,
      isActive: true,
      locations: [location],
      photos: [],
      notes: [],
    };

    await AsyncStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(shift));
    console.log("Shift started:", shift.id, shift.pairCode);
    return shift;
  } catch (error) {
    console.error("Error starting shift:", error);
    throw new Error("Failed to start shift: " + (error as Error).message);
  }
};

// Add location to active shift
export const addLocationToShift = async (
  location: LocationPoint
): Promise<Shift | null> => {
  try {
    const shift = await getActiveShift();
    if (!shift || !shift.isActive) {
      console.log("No active shift to add location");
      return null;
    }

    shift.locations.push(location);
    await AsyncStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(shift));
    return shift;
  } catch (error) {
    console.error("Error adding location:", error);
    return null;
  }
};

// Persist photo to permanent storage
export const persistPhoto = async (tempUri: string): Promise<string | null> => {
  try {
    // Null checks
    if (!tempUri) {
      console.error("persistPhoto: tempUri is empty");
      return null;
    }
    if (!FileSystem.documentDirectory) {
      console.error("persistPhoto: documentDirectory is null");
      return null;
    }

    const filename = tempUri.split('/').pop() || `photo_${Date.now()}.jpg`;
    const photosDir = FileSystem.documentDirectory + "photos/";

    // Ensure directory exists
    const dirInfo = await FileSystem.getInfoAsync(photosDir).catch(() => ({ exists: false }));
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });
    }

    const destPath = photosDir + filename;
    console.log(`[persistPhoto] Copying ${tempUri} -> ${destPath}`);

    // Use copyAsync instead of moveAsync - more reliable
    await FileSystem.copyAsync({
      from: tempUri,
      to: destPath
    });

    // Verify
    const fileInfo = await FileSystem.getInfoAsync(destPath);
    if (!fileInfo.exists) {
      throw new Error("File copy verification failed");
    }

    console.log(`[persistPhoto] Success: ${destPath}`);
    return destPath;
  } catch (error) {
    console.error("Error persisting photo:", error);
    return null;
  }
};

// Add photo to active shift
export const addPhotoToShift = async (photo: ShiftPhoto): Promise<Shift | null> => {
  try {
    const shift = await getActiveShift();
    if (!shift || !shift.isActive) {
      console.log("No active shift to add photo");
      return null;
    }

    // Store photo directly - no file copy needed for Expo camera URIs
    // They persist for the session and can be accessed later
    console.log("[addPhotoToShift] Adding photo:", photo.id, photo.uri);

    shift.photos.push(photo);
    await AsyncStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(shift));
    console.log("Photo added to shift:", photo.id);
    return shift;
  } catch (error) {
    console.error("Error adding photo:", error);
    return null;
  }
};

// Add note to active shift
export const addNoteToShift = async (text: string): Promise<Shift | null> => {
  try {
    const shift = await getActiveShift();
    if (!shift || !shift.isActive) {
      console.log("No active shift to add note");
      return null;
    }

    const note = {
      id: `note_${Date.now()}`,
      timestamp: new Date().toISOString(),
      text: text.trim(),
    };

    // Initialize notes array if it doesn't exist
    if (!shift.notes) {
      shift.notes = [];
    }

    shift.notes.push(note);
    await AsyncStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(shift));
    console.log("Note added to shift:", note.id);
    return shift;
  } catch (error) {
    console.error("Error adding note:", error);
    return null;
  }
};

// End the active shift
export const endShift = async (): Promise<Shift | null> => {
  try {
    const json = await AsyncStorage.getItem(ACTIVE_SHIFT_KEY);
    if (!json) {
      console.log("No active shift to end");
      return null;
    }

    const shift: Shift = JSON.parse(json);
    shift.isActive = false;
    shift.endTime = new Date().toISOString();

    // Get existing history
    let history: Shift[] = [];
    try {
      const historyJson = await AsyncStorage.getItem(SHIFT_HISTORY_KEY);
      if (historyJson) {
        history = JSON.parse(historyJson);
      }
    } catch (e) {
      console.log("No existing history, starting fresh");
    }

    // Add completed shift to beginning of history
    history.unshift(shift);

    // Save history
    await AsyncStorage.setItem(SHIFT_HISTORY_KEY, JSON.stringify(history));
    console.log("Shift saved to history:", shift.id);

    // Clear active shift
    await AsyncStorage.removeItem(ACTIVE_SHIFT_KEY);
    console.log("Active shift cleared");

    return shift;
  } catch (error) {
    console.error("Error ending shift:", error);
    throw new Error("Failed to end shift: " + (error as Error).message);
  }
};

// Get shift history
export const getShiftHistory = async (): Promise<Shift[]> => {
  try {
    const json = await AsyncStorage.getItem(SHIFT_HISTORY_KEY);
    if (!json) return [];
    return JSON.parse(json);
  } catch (error) {
    console.error("Error getting shift history:", error);
    return [];
  }
};

// Get a specific shift by ID
export const getShiftById = async (shiftId: string): Promise<Shift | null> => {
  try {
    const history = await getShiftHistory();
    return history.find((s) => s.id === shiftId) || null;
  } catch (error) {
    console.error("Error getting shift by ID:", error);
    return null;
  }
};

// Delete a shift from history
export const deleteShift = async (shiftId: string): Promise<void> => {
  try {
    const history = await getShiftHistory();
    const updated = history.filter((s) => s.id !== shiftId);
    await AsyncStorage.setItem(SHIFT_HISTORY_KEY, JSON.stringify(updated));
    console.log("Shift deleted:", shiftId);
  } catch (error) {
    console.error("Error deleting shift:", error);
    throw new Error("Failed to delete shift");
  }
};

// Calculate shift duration in minutes
export const getShiftDuration = (shift: Shift): number => {
  const start = new Date(shift.startTime).getTime();
  const end = shift.endTime ? new Date(shift.endTime).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / 60000));
};

// Format duration as HH:MM
export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

// Clear all data (for testing)
export const clearAllData = async (): Promise<void> => {
  await AsyncStorage.removeItem(ACTIVE_SHIFT_KEY);
  await AsyncStorage.removeItem(SHIFT_HISTORY_KEY);
  console.log("All shift data cleared");
};
