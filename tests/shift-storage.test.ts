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
  getShiftDuration,
  formatDuration,
} from "../lib/shift-storage";

describe("Shift Storage", () => {
  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
  });

  describe("generatePairCode", () => {
    it("should generate a 6-character uppercase code", () => {
      const code = generatePairCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-Z0-9]+$/);
    });

    it("should generate unique codes", () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generatePairCode());
      }
      // Most codes should be unique (allowing some collision)
      expect(codes.size).toBeGreaterThan(90);
    });
  });

  describe("startShift", () => {
    it("should create a new shift with correct properties", async () => {
      const location = {
        latitude: 40.7128,
        longitude: -74.006,
        timestamp: new Date().toISOString(),
      };

      const shift = await startShift("John Doe", "Main Office", location);

      expect(shift).toBeDefined();
      expect(shift.staffName).toBe("John Doe");
      expect(shift.siteName).toBe("Main Office");
      expect(shift.isActive).toBe(true);
      expect(shift.pairCode).toHaveLength(6);
      expect(shift.locations).toHaveLength(1);
      expect(shift.photos).toHaveLength(0);
      expect(shift.endTime).toBeNull();
    });

    it("should store the shift in AsyncStorage", async () => {
      const location = {
        latitude: 40.7128,
        longitude: -74.006,
        timestamp: new Date().toISOString(),
      };

      await startShift("Jane", "Site A", location);
      const stored = await getActiveShift();

      expect(stored).toBeDefined();
      expect(stored?.staffName).toBe("Jane");
    });
  });

  describe("addLocationToShift", () => {
    it("should add location to active shift", async () => {
      const location1 = {
        latitude: 40.7128,
        longitude: -74.006,
        timestamp: new Date().toISOString(),
      };
      await startShift("Staff", "Site", location1);

      const location2 = {
        latitude: 40.7129,
        longitude: -74.007,
        timestamp: new Date().toISOString(),
      };
      const updated = await addLocationToShift(location2);

      expect(updated?.locations).toHaveLength(2);
    });

    it("should return null if no active shift", async () => {
      const location = {
        latitude: 40.7128,
        longitude: -74.006,
        timestamp: new Date().toISOString(),
      };
      const result = await addLocationToShift(location);
      expect(result).toBeNull();
    });
  });

  describe("addPhotoToShift", () => {
    it("should add photo to active shift", async () => {
      const location = {
        latitude: 40.7128,
        longitude: -74.006,
        timestamp: new Date().toISOString(),
      };
      await startShift("Staff", "Site", location);

      const photo = {
        id: "photo1",
        uri: "file://photo.jpg",
        timestamp: new Date().toISOString(),
        location: null,
      };
      const updated = await addPhotoToShift(photo);

      expect(updated?.photos).toHaveLength(1);
      expect(updated?.photos[0].id).toBe("photo1");
    });
  });

  describe("endShift", () => {
    it("should end active shift and move to history", async () => {
      const location = {
        latitude: 40.7128,
        longitude: -74.006,
        timestamp: new Date().toISOString(),
      };
      await startShift("Staff", "Site", location);

      const ended = await endShift();

      expect(ended).toBeDefined();
      expect(ended?.isActive).toBe(false);
      expect(ended?.endTime).toBeDefined();

      const active = await getActiveShift();
      expect(active).toBeNull();

      const history = await getShiftHistory();
      expect(history).toHaveLength(1);
    });

    it("should return null if no active shift", async () => {
      const result = await endShift();
      expect(result).toBeNull();
    });
  });

  describe("getShiftDuration", () => {
    it("should calculate duration in minutes", () => {
      const shift = {
        id: "1",
        staffName: "Staff",
        siteName: "Site",
        pairCode: "ABC123",
        startTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        endTime: new Date().toISOString(),
        isActive: false,
        locations: [],
        photos: [],
      };

      const duration = getShiftDuration(shift);
      expect(duration).toBeGreaterThanOrEqual(59);
      expect(duration).toBeLessThanOrEqual(61);
    });
  });

  describe("formatDuration", () => {
    it("should format minutes as hours and minutes", () => {
      expect(formatDuration(0)).toBe("0h 0m");
      expect(formatDuration(30)).toBe("0h 30m");
      expect(formatDuration(60)).toBe("1h 0m");
      expect(formatDuration(90)).toBe("1h 30m");
      expect(formatDuration(150)).toBe("2h 30m");
    });
  });
});
