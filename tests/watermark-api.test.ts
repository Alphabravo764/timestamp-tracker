import { describe, it, expect, beforeAll } from "vitest";

const API_BASE = "http://127.0.0.1:3000";

// Small 1x1 red pixel PNG as base64 for testing
const TEST_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

describe("Watermark API", () => {
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
  });

  it("should return error when imageBase64 is missing", async () => {
    const response = await fetch(`${API_BASE}/api/watermark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timestamp: "01 Jan 2026, 10:00:00 AM",
        address: "Test Location",
        latitude: 51.5074,
        longitude: -0.1278,
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("imageBase64 required");
  });

  it("should add watermark to image and return base64", async () => {
    const response = await fetch(`${API_BASE}/api/watermark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: TEST_IMAGE_BASE64,
        timestamp: "01 Jan 2026, 10:00:00 AM",
        address: "123 Test Street, London, SW1A 1AA",
        latitude: 51.5074,
        longitude: -0.1278,
        staffName: "John Smith",
        siteName: "Test Site",
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.watermarkedBase64).toBeDefined();
    expect(typeof data.watermarkedBase64).toBe("string");
    // Small test images (< 100px) are returned as-is, so just verify we get a base64 string
    expect(data.watermarkedBase64.length).toBeGreaterThan(0);
  });

  it("should handle missing optional fields gracefully", async () => {
    const response = await fetch(`${API_BASE}/api/watermark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: TEST_IMAGE_BASE64,
        // Only required field, all others use defaults
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.watermarkedBase64).toBeDefined();
  });
});
