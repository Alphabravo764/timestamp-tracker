import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Shift, ShiftPhoto, LocationPoint } from "./shift-types";

const ACTIVE_SHIFT_KEY = "activeShift";
const SHIFT_HISTORY_KEY = "shiftHistory";

// Generate 6-character pair code
export const generatePairCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Get active shift
export const getActiveShift = async (): Promise<Shift | null> => {
  try {
    const json = await AsyncStorage.getItem(ACTIVE_SHIFT_KEY);
    return json ? JSON.parse(json) : null;
  } catch (error) {
    console.error("Error getting active shift:", error);
    return null;
  }
};

// Start a new shift
export const startShift = async (staffName: string, siteName: string, location: LocationPoint): Promise<Shift> => {
  const shift: Shift = {
    id: Date.now().toString(),
    staffName,
    siteName,
    pairCode: generatePairCode(),
    startTime: new Date().toISOString(),
    endTime: null,
    isActive: true,
    locations: [location],
    photos: [],
  };

  await AsyncStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(shift));
  return shift;
};

// Add location to active shift
export const addLocationToShift = async (location: LocationPoint): Promise<Shift | null> => {
  const shift = await getActiveShift();
  if (!shift || !shift.isActive) return null;

  shift.locations.push(location);
  await AsyncStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(shift));
  return shift;
};

// Add photo to active shift
export const addPhotoToShift = async (photo: ShiftPhoto): Promise<Shift | null> => {
  const shift = await getActiveShift();
  if (!shift || !shift.isActive) return null;

  shift.photos.push(photo);
  await AsyncStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(shift));
  return shift;
};

// End the active shift
export const endShift = async (): Promise<Shift | null> => {
  const shift = await getActiveShift();
  if (!shift) return null;

  shift.isActive = false;
  shift.endTime = new Date().toISOString();

  // Save to history
  const historyJson = await AsyncStorage.getItem(SHIFT_HISTORY_KEY);
  const history: Shift[] = historyJson ? JSON.parse(historyJson) : [];
  history.unshift(shift);
  await AsyncStorage.setItem(SHIFT_HISTORY_KEY, JSON.stringify(history));

  // Clear active shift
  await AsyncStorage.removeItem(ACTIVE_SHIFT_KEY);

  return shift;
};

// Get shift history
export const getShiftHistory = async (): Promise<Shift[]> => {
  try {
    const json = await AsyncStorage.getItem(SHIFT_HISTORY_KEY);
    return json ? JSON.parse(json) : [];
  } catch (error) {
    console.error("Error getting shift history:", error);
    return [];
  }
};

// Get a specific shift by ID
export const getShiftById = async (shiftId: string): Promise<Shift | null> => {
  const history = await getShiftHistory();
  return history.find((s) => s.id === shiftId) || null;
};

// Delete a shift from history
export const deleteShift = async (shiftId: string): Promise<void> => {
  const history = await getShiftHistory();
  const updated = history.filter((s) => s.id !== shiftId);
  await AsyncStorage.setItem(SHIFT_HISTORY_KEY, JSON.stringify(updated));
};

// Calculate shift duration in minutes
export const getShiftDuration = (shift: Shift): number => {
  const start = new Date(shift.startTime).getTime();
  const end = shift.endTime ? new Date(shift.endTime).getTime() : Date.now();
  return Math.floor((end - start) / 60000);
};

// Format duration as HH:MM
export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};
