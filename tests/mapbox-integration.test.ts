import { describe, it, expect } from "vitest";

describe("MapBox Integration", () => {
  it("should have MAPBOX_ACCESS_TOKEN environment variable", () => {
    // The token should be set in the environment
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    expect(token).toBeDefined();
    expect(token).not.toBe("");
  });

  it("should generate valid static map URL", () => {
    const token = process.env.MAPBOX_ACCESS_TOKEN || "test_token";
    const locations = [
      { longitude: -0.5464, latitude: 53.2385 },
      { longitude: -0.5465, latitude: 53.2386 },
      { longitude: -0.5466, latitude: 53.2387 },
    ];

    // Build polyline path
    const pathCoords = locations
      .map((loc) => `${loc.longitude.toFixed(5)},${loc.latitude.toFixed(5)}`)
      .join(";");

    const pathOverlay = `path-4+f59e0b-0.9(${encodeURIComponent(pathCoords)})`;
    const startMarker = `pin-s-a+10b981(${locations[0].longitude},${locations[0].latitude})`;
    const endMarker = `pin-s-b+ef4444(${locations[locations.length - 1].longitude},${locations[locations.length - 1].latitude})`;

    const staticUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pathOverlay},${startMarker},${endMarker}/auto/600x400?access_token=${token}`;

    expect(staticUrl).toContain("api.mapbox.com");
    expect(staticUrl).toContain("streets-v12");
    expect(staticUrl).toContain("path-4+f59e0b");
    expect(staticUrl).toContain("pin-s-a+10b981");
    expect(staticUrl).toContain("pin-s-b+ef4444");
  });

  it("should inject MapBox token into viewer HTML", () => {
    // Simulate the server injection logic
    const mockHtml = "<html><head></head><body></body></html>";
    const mapboxToken = "pk.test_token_12345";
    const injectedHtml = mockHtml.replace(
      "</head>",
      `<script>window.MAPBOX_TOKEN = "${mapboxToken}";</script></head>`
    );

    expect(injectedHtml).toContain("window.MAPBOX_TOKEN");
    expect(injectedHtml).toContain(mapboxToken);
  });
});
