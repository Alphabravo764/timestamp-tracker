import { describe, it, expect, beforeAll } from "vitest";

const API_BASE = "http://127.0.0.1:3000";

// Small 1x1 red pixel PNG as base64 for testing
const TEST_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

describe("Photo Upload API", () => {
  // Use 6-char pair code to match schema (varchar(10))
  const testPairCode = `T${Date.now().toString().slice(-5)}`;

  beforeAll(async () => {
    // Wait for server to be ready
    let retries = 5;
    while (retries > 0) {
      try {
        const res = await fetch(`${API_BASE}/api/health`);
        if (res.ok) break;
      } catch {
        // Server not ready yet
      }
      await new Promise((r) => setTimeout(r, 500));
      retries--;
    }

    // Create a test shift first
    const response = await fetch(`${API_BASE}/api/sync/shift`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairCode: testPairCode,
        shiftId: `shift_${Date.now()}`,
        staffName: "Test Guard",
        siteName: "Test Site",
        startTime: new Date().toISOString(),
      }),
    });
    
    if (!response.ok) {
      console.error("Failed to create test shift:", await response.text());
    }
  });

  it("should reject photo sync without pairCode", async () => {
    const response = await fetch(`${API_BASE}/api/sync/photo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photoUri: "data:image/png;base64," + TEST_IMAGE_BASE64,
        timestamp: new Date().toISOString(),
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("pairCode required");
  });

  it("should accept photo with base64 data URI and upload to S3", async () => {
    const response = await fetch(`${API_BASE}/api/sync/photo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairCode: testPairCode,
        photoUri: "data:image/png;base64," + TEST_IMAGE_BASE64,
        latitude: 51.5074,
        longitude: -0.1278,
        timestamp: new Date().toISOString(),
        address: "Test Location",
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    // Should return a cloud URL from S3
    expect(data.photoUrl).toBeDefined();
    expect(data.photoUrl).toContain("https://");
  });

  it("should accept photo with file URI (stores as-is)", async () => {
    const response = await fetch(`${API_BASE}/api/sync/photo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pairCode: testPairCode,
        photoUri: "file:///path/to/local/photo.jpg",
        latitude: 51.5074,
        longitude: -0.1278,
        timestamp: new Date().toISOString(),
        address: "Test Location",
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it("should retrieve shift with photos including cloud URLs", async () => {
    const response = await fetch(`${API_BASE}/api/sync/shift/${testPairCode}`);
    
    expect(response.status).toBe(200);
    const shift = await response.json();
    expect(shift.pairCode).toBe(testPairCode);
    expect(shift.photos).toBeDefined();
    expect(Array.isArray(shift.photos)).toBe(true);
    expect(shift.photos.length).toBeGreaterThan(0);
    
    // Check that at least one photo has a cloud URL
    const cloudPhotos = shift.photos.filter((p: any) => p.photoUri.startsWith("https://"));
    expect(cloudPhotos.length).toBeGreaterThan(0);
  });
});
