import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Shift, ShiftNote, LocationPoint } from "./shift-types";
import { getActiveShift } from "./shift-storage";

const ACTIVE_SHIFT_KEY = "@timestamp_camera_active_shift";

/**
 * Add a note to the active shift
 */
export const addNoteToShift = async (
  text: string,
  location?: LocationPoint
): Promise<ShiftNote | null> => {
  try {
    const shift = await getActiveShift();
    if (!shift || !shift.isActive) {
      console.log("No active shift to add note");
      return null;
    }

    const note: ShiftNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      text,
      location,
    };

    if (!shift.notes) {
      shift.notes = [];
    }

    shift.notes.push(note);
    await AsyncStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(shift));
    console.log("Note added to shift:", note.id);
    return note;
  } catch (error) {
    console.error("Error adding note:", error);
    return null;
  }
};

/**
 * Get all notes from a shift
 */
export const getShiftNotes = (shift: Shift): ShiftNote[] => {
  return shift.notes || [];
};

/**
 * Delete a note from the active shift
 */
export const deleteNoteFromShift = async (noteId: string): Promise<boolean> => {
  try {
    const shift = await getActiveShift();
    if (!shift || !shift.notes) {
      return false;
    }

    shift.notes = shift.notes.filter(n => n.id !== noteId);
    await AsyncStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(shift));
    console.log("Note deleted:", noteId);
    return true;
  } catch (error) {
    console.error("Error deleting note:", error);
    return false;
  }
};

/**
 * Update a note in the active shift
 */
export const updateNoteInShift = async (
  noteId: string,
  text: string
): Promise<ShiftNote | null> => {
  try {
    const shift = await getActiveShift();
    if (!shift || !shift.notes) {
      return null;
    }

    const note = shift.notes.find(n => n.id === noteId);
    if (!note) {
      return null;
    }

    note.text = text;
    await AsyncStorage.setItem(ACTIVE_SHIFT_KEY, JSON.stringify(shift));
    console.log("Note updated:", noteId);
    return note;
  } catch (error) {
    console.error("Error updating note:", error);
    return null;
  }
};

/**
 * Format notes for display in reports
 */
export const formatNotesForReport = (notes: ShiftNote[]): string => {
  if (notes.length === 0) return "";

  let report = "📝 SHIFT NOTES\n";
  report += "───────────────────────────\n";

  notes.forEach((note, index) => {
    const time = new Date(note.timestamp).toLocaleTimeString();
    report += `${index + 1}. [${time}] ${note.text}\n`;
    if (note.location) {
      report += `   📍 ${note.location.latitude.toFixed(6)}, ${note.location.longitude.toFixed(6)}\n`;
    }
  });

  return report + "\n";
};
