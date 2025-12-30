import { describe, it, expect } from "vitest";

interface PhotoData {
  id: string;
  uri: string;
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
  } | null;
}

describe("Photo Storage", () => {
  it("should create valid photo data structure", () => {
    const photo: PhotoData = {
      id: "123456789",
      uri: "file:///path/to/photo.jpg",
      timestamp: "12/30/2024 10:30:00",
      location: {
        latitude: 40.7128,
        longitude: -74.006,
        accuracy: 10,
      },
    };

    expect(photo.id).toBe("123456789");
    expect(photo.uri).toContain("photo.jpg");
    expect(photo.timestamp).toContain("2024");
    expect(photo.location?.latitude).toBe(40.7128);
    expect(photo.location?.longitude).toBe(-74.006);
  });

  it("should handle photo without location", () => {
    const photo: PhotoData = {
      id: "987654321",
      uri: "file:///path/to/photo2.jpg",
      timestamp: "12/30/2024 11:00:00",
      location: null,
    };

    expect(photo.location).toBeNull();
  });

  it("should format coordinates correctly", () => {
    const formatCoordinate = (value: number, type: "lat" | "lng") => {
      const direction = type === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
      return `${Math.abs(value).toFixed(6)}° ${direction}`;
    };

    expect(formatCoordinate(40.7128, "lat")).toBe("40.712800° N");
    expect(formatCoordinate(-74.006, "lng")).toBe("74.006000° W");
    expect(formatCoordinate(-33.8688, "lat")).toBe("33.868800° S");
    expect(formatCoordinate(151.2093, "lng")).toBe("151.209300° E");
  });
});
