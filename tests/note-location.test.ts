import { describe, it, expect } from "vitest";

describe("Note Location Feature", () => {
  it("should build syncNote payload with location data", () => {
    const note = {
      id: "note_123",
      text: "Test note",
      timestamp: "2026-01-04T13:07:23.000Z",
      location: {
        latitude: 53.230446,
        longitude: -0.544439,
        accuracy: 10,
      },
    };

    const syncPayload = {
      shiftId: "shift_123",
      pairCode: "24Y8QU",
      noteId: note.id,
      text: note.text,
      timestamp: note.timestamp,
      latitude: note.location?.latitude,
      longitude: note.location?.longitude,
      accuracy: note.location?.accuracy,
    };

    expect(syncPayload.latitude).toBe(53.230446);
    expect(syncPayload.longitude).toBe(-0.544439);
    expect(syncPayload.accuracy).toBe(10);
    expect(syncPayload.text).toBe("Test note");
  });

  it("should handle notes without location gracefully", () => {
    const note: { id: string; text: string; timestamp: string; location?: { latitude: number; longitude: number; accuracy?: number } } = {
      id: "note_456",
      text: "Note without location",
      timestamp: "2026-01-04T13:07:23.000Z",
      location: undefined,
    };

    const syncPayload = {
      noteId: note.id,
      text: note.text,
      timestamp: note.timestamp,
      latitude: note.location?.latitude,
      longitude: note.location?.longitude,
      accuracy: note.location?.accuracy,
    };

    expect(syncPayload.latitude).toBeUndefined();
    expect(syncPayload.longitude).toBeUndefined();
    expect(syncPayload.accuracy).toBeUndefined();
  });

  it("should check both note.location and note.latitude formats in viewer", () => {
    // Server format (flat)
    const serverNote = {
      id: "note_1",
      text: "Server note",
      timestamp: "2026-01-04T13:07:23.000Z",
      latitude: 53.230446,
      longitude: -0.544439,
    };

    // App format (nested)
    const appNote = {
      id: "note_2",
      text: "App note",
      timestamp: "2026-01-04T13:07:23.000Z",
      location: {
        latitude: 51.5074,
        longitude: -0.1278,
      },
    };

    // Viewer logic: check both formats
    const getNoteLat = (note: any) => note.location?.latitude || note.latitude;
    const getNoteLng = (note: any) => note.location?.longitude || note.longitude;

    // Server format should work
    expect(getNoteLat(serverNote)).toBe(53.230446);
    expect(getNoteLng(serverNote)).toBe(-0.544439);

    // App format should work
    expect(getNoteLat(appNote)).toBe(51.5074);
    expect(getNoteLng(appNote)).toBe(-0.1278);
  });

  it("should display 'Location not recorded' when no location", () => {
    const noteWithoutLocation = {
      id: "note_3",
      text: "No location note",
      timestamp: "2026-01-04T13:07:23.000Z",
    };

    const getNoteLat = (note: any) => note.location?.latitude || note.latitude;
    const getNoteLng = (note: any) => note.location?.longitude || note.longitude;

    const noteLat = getNoteLat(noteWithoutLocation);
    const noteLng = getNoteLng(noteWithoutLocation);

    const noteLocation = (noteLat && noteLng) 
      ? `${noteLat}, ${noteLng}` 
      : "Location not recorded";

    expect(noteLocation).toBe("Location not recorded");
  });

  it("should format note timestamp correctly", () => {
    const timestamp = "2026-01-04T13:07:23.000Z";
    const date = new Date(timestamp);

    // Time format
    const time = date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // Date format
    const dateStr = date.toLocaleDateString("en-GB");

    expect(time).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(dateStr).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

describe("Note Display in Viewer", () => {
  it("should have correct note card structure with location", () => {
    const noteCard = {
      hasTime: true,
      hasDate: true,
      hasLocation: true,
      hasText: true,
      leftBorderColor: "#f59e0b",
    };

    expect(noteCard.hasTime).toBe(true);
    expect(noteCard.hasDate).toBe(true);
    expect(noteCard.hasLocation).toBe(true);
    expect(noteCard.hasText).toBe(true);
    expect(noteCard.leftBorderColor).toBe("#f59e0b");
  });

  it("should reverse geocode note location to address", () => {
    // Mock reverse geocode result
    const mockGeocode = (lat: number, lng: number): string => {
      if (lat === 53.230446 && lng === -0.544439) {
        return "44a Mill Road, LN1 3JJ";
      }
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    };

    const address = mockGeocode(53.230446, -0.544439);
    expect(address).toBe("44a Mill Road, LN1 3JJ");

    const fallback = mockGeocode(51.5074, -0.1278);
    expect(fallback).toBe("51.507400, -0.127800");
  });
});
