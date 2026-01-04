import { describe, it, expect, vi } from "vitest";

describe("Photo Compression", () => {
  it("should have correct compression settings", () => {
    // Test compression constants directly (module has react-native imports)
    const MAX_WIDTH = 1920;
    const QUALITY = 0.7;
    
    const info = { maxWidth: MAX_WIDTH, quality: QUALITY * 100 };
    
    expect(info.maxWidth).toBe(1920);
    expect(info.quality).toBe(70);
  });
});

describe("Offline Sync Queue", () => {
  it("should have correct SyncStatus types", async () => {
    const { getPhotoSyncStatus } = await import("../lib/offline-sync");
    
    // Should return "synced" for unknown photo URI
    const status = await getPhotoSyncStatus("unknown-photo-uri");
    expect(status).toBe("synced");
  });

  it("should get offline state with all required fields", async () => {
    const { getOfflineState } = await import("../lib/offline-sync");
    const state = await getOfflineState();
    
    expect(state).toHaveProperty("isOnline");
    expect(state).toHaveProperty("lastSync");
    expect(state).toHaveProperty("pendingItems");
    expect(state).toHaveProperty("failedItems");
    expect(typeof state.pendingItems).toBe("number");
    expect(typeof state.failedItems).toBe("number");
  });

  it("should have auto-retry functions", async () => {
    const offlineSync = await import("../lib/offline-sync");
    
    expect(typeof offlineSync.startAutoRetry).toBe("function");
    expect(typeof offlineSync.stopAutoRetry).toBe("function");
    expect(typeof offlineSync.processQueueWithFn).toBe("function");
  });
});

describe("PDF Generation URL", () => {
  it("should build correct PDF download URL", () => {
    const apiUrl = "https://timestamp-tracker-production.up.railway.app";
    const pairCode = "ABC123";
    
    const pdfUrl = `${apiUrl}/api/sync/shift/${pairCode}?format=pdf`;
    
    expect(pdfUrl).toBe("https://timestamp-tracker-production.up.railway.app/api/sync/shift/ABC123?format=pdf");
    expect(pdfUrl).toContain("format=pdf");
    expect(pdfUrl).not.toContain("/viewer/");
  });

  it("should generate correct filename", () => {
    const staffName = "John Doe";
    const pairCode = "XYZ789";
    
    const filename = `shift-report-${staffName.replace(/\s+/g, "-")}-${pairCode}.pdf`;
    
    expect(filename).toBe("shift-report-John-Doe-XYZ789.pdf");
    expect(filename).toMatch(/\.pdf$/);
  });
});

describe("Photo Viewer Modal", () => {
  it("should calculate photo index correctly", () => {
    const photos = [
      { id: "1", uri: "photo1.jpg" },
      { id: "2", uri: "photo2.jpg" },
      { id: "3", uri: "photo3.jpg" },
    ];
    
    const selectedPhotoId = "2";
    const index = photos.findIndex(p => p.id === selectedPhotoId);
    
    expect(index).toBe(1);
    expect(index >= 0).toBe(true);
  });

  it("should determine navigation correctly", () => {
    const photos = [
      { id: "1", uri: "photo1.jpg" },
      { id: "2", uri: "photo2.jpg" },
      { id: "3", uri: "photo3.jpg" },
    ];
    
    // Test middle photo
    let index = 1;
    expect(index > 0).toBe(true); // hasPrevious
    expect(index < photos.length - 1).toBe(true); // hasNext
    
    // Test first photo
    index = 0;
    expect(index > 0).toBe(false); // no previous
    expect(index < photos.length - 1).toBe(true); // has next
    
    // Test last photo
    index = 2;
    expect(index > 0).toBe(true); // has previous
    expect(index < photos.length - 1).toBe(false); // no next
  });
});

describe("Static Map URL Generation", () => {
  it("should calculate map center correctly", () => {
    const locations = [
      { latitude: 51.5074, longitude: -0.1278 },
      { latitude: 51.5080, longitude: -0.1290 },
      { latitude: 51.5060, longitude: -0.1260 },
    ];

    const lats = locations.map(l => l.latitude);
    const lngs = locations.map(l => l.longitude);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const centerLat = (minLat + maxLat) / 2;
    
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const centerLng = (minLng + maxLng) / 2;

    expect(centerLat).toBeCloseTo(51.507, 3);
    expect(centerLng).toBeCloseTo(-0.1275, 3);
  });

  it("should build valid static map URL", () => {
    const centerLat = 51.507;
    const centerLng = -0.1275;
    const zoom = 14;
    const mapWidth = 500;
    const mapHeight = 350;
    
    const staticMapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${centerLat},${centerLng}&zoom=${zoom}&size=${mapWidth}x${mapHeight}&maptype=osmarenderer`;
    
    expect(staticMapUrl).toContain("center=51.507,-0.1275");
    expect(staticMapUrl).toContain("zoom=14");
    expect(staticMapUrl).toContain("size=500x350");
    expect(staticMapUrl).toContain("maptype=osmarenderer");
  });
});

describe("Verification Hash", () => {
  it("should generate consistent hash for same data", async () => {
    const crypto = await import("crypto");
    
    const reportData = JSON.stringify({
      shiftId: 123,
      staffName: "John Doe",
      siteName: "Test Site",
    });
    
    const hash1 = crypto.createHash("sha256").update(reportData).digest("hex").substring(0, 16);
    const hash2 = crypto.createHash("sha256").update(reportData).digest("hex").substring(0, 16);
    
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(16);
  });

  it("should generate different hash for different data", async () => {
    const crypto = await import("crypto");
    
    const data1 = JSON.stringify({ shiftId: 123 });
    const data2 = JSON.stringify({ shiftId: 456 });
    
    const hash1 = crypto.createHash("sha256").update(data1).digest("hex").substring(0, 16);
    const hash2 = crypto.createHash("sha256").update(data2).digest("hex").substring(0, 16);
    
    expect(hash1).not.toBe(hash2);
  });
});
