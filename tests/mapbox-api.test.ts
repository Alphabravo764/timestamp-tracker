import { describe, it, expect } from "vitest";

describe("MapBox API Key Validation", () => {
  it("should have MAPBOX_ACCESS_TOKEN environment variable set", () => {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    expect(token).toBeDefined();
    expect(token).not.toBe("");
    expect(token?.startsWith("pk.")).toBe(true);
  });

  it("should be able to generate a valid static map URL", async () => {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (!token) {
      throw new Error("MAPBOX_ACCESS_TOKEN not set");
    }

    // Test coordinates (Lincoln, UK)
    const lng = -0.544439;
    const lat = 53.230446;
    const zoom = 14;
    const width = 600;
    const height = 400;

    // Build static map URL
    const staticMapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${lng},${lat},${zoom}/${width}x${height}?access_token=${token}`;

    // Verify URL structure
    expect(staticMapUrl).toContain("api.mapbox.com");
    expect(staticMapUrl).toContain("streets-v12");
    expect(staticMapUrl).toContain(`${lng},${lat}`);
    expect(staticMapUrl).toContain(`access_token=${token}`);

    // Make a HEAD request to verify the token works
    const response = await fetch(staticMapUrl, { method: "HEAD" });
    
    // MapBox returns 200 for valid requests
    expect(response.status).toBe(200);
  });

  it("should be able to encode polyline for static map", () => {
    // Test polyline encoding (simplified Google Polyline Algorithm)
    const encodePolyline = (coordinates: [number, number][]): string => {
      let encoded = "";
      let prevLat = 0;
      let prevLng = 0;

      for (const [lat, lng] of coordinates) {
        const latE5 = Math.round(lat * 1e5);
        const lngE5 = Math.round(lng * 1e5);

        encoded += encodeNumber(latE5 - prevLat);
        encoded += encodeNumber(lngE5 - prevLng);

        prevLat = latE5;
        prevLng = lngE5;
      }

      return encoded;
    };

    const encodeNumber = (num: number): string => {
      let encoded = "";
      let value = num < 0 ? ~(num << 1) : num << 1;

      while (value >= 0x20) {
        encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
        value >>= 5;
      }
      encoded += String.fromCharCode(value + 63);

      return encoded;
    };

    // Test with simple coordinates
    const coords: [number, number][] = [
      [53.230446, -0.544439],
      [53.231000, -0.545000],
    ];

    const polyline = encodePolyline(coords);
    expect(polyline).toBeDefined();
    expect(polyline.length).toBeGreaterThan(0);
  });

  it("should build static map URL with polyline overlay", () => {
    const token = process.env.MAPBOX_ACCESS_TOKEN || "test_token";
    
    // Encoded polyline (example)
    const encodedPolyline = "mfp_I~bpAiB";
    const polylineColor = "f59e0b"; // Amber color
    const polylineWidth = 4;

    // Build URL with path overlay
    const pathOverlay = `path-${polylineWidth}+${polylineColor}(${encodeURIComponent(encodedPolyline)})`;
    
    const lng = -0.544439;
    const lat = 53.230446;
    const zoom = 14;
    const width = 600;
    const height = 400;

    const staticMapUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pathOverlay}/${lng},${lat},${zoom}/${width}x${height}?access_token=${token}`;

    expect(staticMapUrl).toContain("path-4+f59e0b");
    expect(staticMapUrl).toContain(encodeURIComponent(encodedPolyline));
  });
});
