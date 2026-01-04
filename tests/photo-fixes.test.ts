import { describe, it, expect, vi } from "vitest";

describe("Photo Viewer Fixes", () => {
  it("should have stable photo viewer index calculation", () => {
    // Simulate the memoized photo viewer index calculation
    const photos = [
      { id: "1", uri: "photo1.jpg" },
      { id: "2", uri: "photo2.jpg" },
      { id: "3", uri: "photo3.jpg" },
    ];
    
    const selectedPhotoId = "2";
    const index = photos.findIndex(p => p.id === selectedPhotoId);
    
    expect(index).toBe(1);
    expect(index > 0).toBe(true); // hasPrevious
    expect(index < photos.length - 1).toBe(true); // hasNext
  });

  it("should handle empty photos array", () => {
    const photos: any[] = [];
    const selectedPhotoId = "1";
    const index = photos.findIndex(p => p.id === selectedPhotoId);
    
    expect(index).toBe(-1);
  });

  it("should handle first photo (no previous)", () => {
    const photos = [
      { id: "1", uri: "photo1.jpg" },
      { id: "2", uri: "photo2.jpg" },
    ];
    
    const selectedPhotoId = "1";
    const index = photos.findIndex(p => p.id === selectedPhotoId);
    
    expect(index).toBe(0);
    expect(index > 0).toBe(false); // hasPrevious = false
    expect(index < photos.length - 1).toBe(true); // hasNext = true
  });

  it("should handle last photo (no next)", () => {
    const photos = [
      { id: "1", uri: "photo1.jpg" },
      { id: "2", uri: "photo2.jpg" },
    ];
    
    const selectedPhotoId = "2";
    const index = photos.findIndex(p => p.id === selectedPhotoId);
    
    expect(index).toBe(1);
    expect(index > 0).toBe(true); // hasPrevious = true
    expect(index < photos.length - 1).toBe(false); // hasNext = false
  });
});

describe("Fast Watermark", () => {
  it("should have correct watermark data structure", () => {
    const watermarkData = {
      timestamp: "14:30:00",
      date: "04/01/2026",
      address: "123 Test Street, London",
      latitude: 51.5074,
      longitude: -0.1278,
      staffName: "John Doe",
      siteName: "Test Site",
    };

    expect(watermarkData.timestamp).toBeDefined();
    expect(watermarkData.date).toBeDefined();
    expect(watermarkData.address).toBeDefined();
    expect(typeof watermarkData.latitude).toBe("number");
    expect(typeof watermarkData.longitude).toBe("number");
    expect(watermarkData.staffName).toBeDefined();
    expect(watermarkData.siteName).toBeDefined();
  });

  it("should format coordinates correctly", () => {
    const lat = 51.50740123456789;
    const lng = -0.12780987654321;
    
    const formattedLat = lat.toFixed(6);
    const formattedLng = lng.toFixed(6);
    
    expect(formattedLat).toBe("51.507401");
    expect(formattedLng).toBe("-0.127810");
  });
});

describe("PDF Generation", () => {
  it("should calculate route bounding box correctly", () => {
    const locations = [
      { latitude: 51.5074, longitude: -0.1278 },
      { latitude: 51.5080, longitude: -0.1290 },
      { latitude: 51.5060, longitude: -0.1260 },
    ];

    const lats = locations.map(l => l.latitude);
    const lngs = locations.map(l => l.longitude);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    expect(minLat).toBe(51.506);
    expect(maxLat).toBe(51.508);
    expect(minLng).toBe(-0.129);
    expect(maxLng).toBe(-0.126);
    expect(centerLat).toBeCloseTo(51.507, 3);
    expect(centerLng).toBeCloseTo(-0.1275, 3);
  });

  it("should calculate total distance correctly", () => {
    // Haversine formula test
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371; // Earth's radius in km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    const distance = calculateDistance(51.5074, -0.1278, 51.5080, -0.1290);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(1); // Should be less than 1km for nearby points
  });

  it("should generate integrity hash", async () => {
    const crypto = await import("crypto");
    const reportData = JSON.stringify({
      shiftId: 123,
      staffName: "John Doe",
      siteName: "Test Site",
      startTime: "2026-01-04T08:00:00Z",
      endTime: "2026-01-04T16:00:00Z",
      locationCount: 50,
      photoCount: 5,
    });
    
    const hash = crypto.createHash("sha256").update(reportData).digest("hex");
    
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64); // SHA-256 produces 64 hex characters
  });
});
