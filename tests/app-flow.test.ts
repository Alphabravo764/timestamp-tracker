import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
  },
}));

import {
  generatePairCode,
  startShift,
  getActiveShift,
  endShift,
  addLocationToShift,
  addPhotoToShift,
  getShiftHistory,
  formatDuration,
} from "../lib/shift-storage";
import type { ShiftPhoto } from "../lib/shift-types";

describe("Complete App Flow", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  });

  it("should complete a full shift workflow", async () => {
    // 1. Start shift with location
    const startLocation = {
      latitude: 51.5074,
      longitude: -0.1278,
      timestamp: new Date().toISOString(),
      address: "10 Downing Street, London, SW1A 2AA",
    };

    const shift = await startShift("John Smith", "Main Office", startLocation);
    
    expect(shift).toBeDefined();
    expect(shift.staffName).toBe("John Smith");
    expect(shift.siteName).toBe("Main Office");
    expect(shift.isActive).toBe(true);
    expect(shift.pairCode).toHaveLength(6);
    expect(shift.locations).toHaveLength(1);
    expect(shift.locations[0].address).toBe("10 Downing Street, London, SW1A 2AA");

    // 2. Verify active shift is stored
    const activeShift = await getActiveShift();
    expect(activeShift).toBeDefined();
    expect(activeShift?.id).toBe(shift.id);

    // 3. Add more locations (simulating GPS tracking)
    const location2 = {
      latitude: 51.5080,
      longitude: -0.1280,
      timestamp: new Date().toISOString(),
      address: "Whitehall, London, SW1A",
    };
    await addLocationToShift(location2);

    const location3 = {
      latitude: 51.5085,
      longitude: -0.1285,
      timestamp: new Date().toISOString(),
      address: "Trafalgar Square, London, WC2N",
    };
    const updatedShift = await addLocationToShift(location3);
    
    expect(updatedShift?.locations).toHaveLength(3);

    // 4. Take photos during shift
    const photo1: ShiftPhoto = {
      id: "photo1",
      uri: "file://photo1.jpg",
      timestamp: new Date().toISOString(),
      location: {
        latitude: 51.5080,
        longitude: -0.1280,
        timestamp: new Date().toISOString(),
      },
      address: "Whitehall, London, SW1A",
    };
    await addPhotoToShift(photo1);

    const photo2: ShiftPhoto = {
      id: "photo2",
      uri: "file://photo2.jpg",
      timestamp: new Date().toISOString(),
      location: {
        latitude: 51.5085,
        longitude: -0.1285,
        timestamp: new Date().toISOString(),
      },
      address: "Trafalgar Square, London, WC2N",
    };
    const shiftWithPhotos = await addPhotoToShift(photo2);

    expect(shiftWithPhotos?.photos).toHaveLength(2);
    expect(shiftWithPhotos?.photos[0].address).toBe("Whitehall, London, SW1A");
    expect(shiftWithPhotos?.photos[1].address).toBe("Trafalgar Square, London, WC2N");

    // 5. End shift
    const completedShift = await endShift();
    
    expect(completedShift).toBeDefined();
    expect(completedShift?.isActive).toBe(false);
    expect(completedShift?.endTime).toBeDefined();
    expect(completedShift?.locations).toHaveLength(3);
    expect(completedShift?.photos).toHaveLength(2);

    // 6. Verify no active shift
    const noActiveShift = await getActiveShift();
    expect(noActiveShift).toBeNull();

    // 7. Verify shift is in history
    const history = await getShiftHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe(shift.id);
    expect(history[0].siteName).toBe("Main Office");
  });

  it("should generate unique pair codes", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const code = generatePairCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-Z0-9]+$/);
      codes.add(code);
    }
    // Most should be unique
    expect(codes.size).toBeGreaterThan(45);
  });

  it("should format duration correctly", () => {
    expect(formatDuration(0)).toBe("0h 0m");
    expect(formatDuration(15)).toBe("0h 15m");
    expect(formatDuration(60)).toBe("1h 0m");
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(125)).toBe("2h 5m");
    expect(formatDuration(480)).toBe("8h 0m");
  });

  it("should handle multiple shifts in history", async () => {
    // Create and complete first shift
    const loc1 = { latitude: 51.5, longitude: -0.1, timestamp: new Date().toISOString() };
    await startShift("Staff A", "Site 1", loc1);
    await endShift();

    // Create and complete second shift
    const loc2 = { latitude: 51.6, longitude: -0.2, timestamp: new Date().toISOString() };
    await startShift("Staff B", "Site 2", loc2);
    await endShift();

    // Create and complete third shift
    const loc3 = { latitude: 51.7, longitude: -0.3, timestamp: new Date().toISOString() };
    await startShift("Staff C", "Site 3", loc3);
    await endShift();

    const history = await getShiftHistory();
    expect(history).toHaveLength(3);
    
    // Should be in reverse chronological order (newest first)
    expect(history[0].siteName).toBe("Site 3");
    expect(history[1].siteName).toBe("Site 2");
    expect(history[2].siteName).toBe("Site 1");
  });
});
