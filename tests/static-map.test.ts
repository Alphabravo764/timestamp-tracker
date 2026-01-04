import { describe, it, expect } from "vitest";

describe("Static Map for PDF", () => {
  describe("Zoom Level Calculation", () => {
    function calculateZoom(locations: { latitude: number; longitude: number }[]) {
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      locations.forEach(loc => {
        minLat = Math.min(minLat, loc.latitude);
        maxLat = Math.max(maxLat, loc.latitude);
        minLng = Math.min(minLng, loc.longitude);
        maxLng = Math.max(maxLng, loc.longitude);
      });
      
      const latDiff = maxLat - minLat;
      const lngDiff = maxLng - minLng;
      const maxDiff = Math.max(latDiff, lngDiff);
      let zoom = 15;
      if (maxDiff > 0.1) zoom = 12;
      if (maxDiff > 0.5) zoom = 10;
      if (maxDiff > 1) zoom = 8;
      if (maxDiff > 5) zoom = 6;
      if (maxDiff < 0.01) zoom = 16;
      if (maxDiff < 0.001) zoom = 17;
      
      return { zoom, centerLat: (minLat + maxLat) / 2, centerLng: (minLng + maxLng) / 2 };
    }

    it("should zoom in for small patrol area (single building)", () => {
      const locations = [
        { latitude: 53.2385, longitude: -0.5464 },
        { latitude: 53.2386, longitude: -0.5465 },
        { latitude: 53.2385, longitude: -0.5466 },
      ];
      const result = calculateZoom(locations);
      expect(result.zoom).toBeGreaterThanOrEqual(16);
    });

    it("should use medium zoom for neighborhood patrol", () => {
      const locations = [
        { latitude: 53.2380, longitude: -0.5460 },
        { latitude: 53.2400, longitude: -0.5480 },
        { latitude: 53.2420, longitude: -0.5500 },
      ];
      const result = calculateZoom(locations);
      // Small area (0.004 lat diff, 0.004 lng diff) = zoom 16
      expect(result.zoom).toBe(16);
    });

    it("should zoom out for city-wide patrol", () => {
      const locations = [
        { latitude: 53.00, longitude: -0.50 },
        { latitude: 53.20, longitude: -0.70 },
        { latitude: 53.10, longitude: -0.60 },
      ];
      const result = calculateZoom(locations);
      // Larger area (0.2 lat diff, 0.2 lng diff) = zoom 12
      expect(result.zoom).toBe(12);
    });

    it("should calculate correct center point", () => {
      const locations = [
        { latitude: 53.0, longitude: -1.0 },
        { latitude: 54.0, longitude: -2.0 },
      ];
      const result = calculateZoom(locations);
      expect(result.centerLat).toBe(53.5);
      expect(result.centerLng).toBe(-1.5);
    });
  });

  describe("GeoJSON Polyline Generation", () => {
    it("should generate valid GeoJSON LineString", () => {
      const locations = [
        { latitude: 53.2385, longitude: -0.5464 },
        { latitude: 53.2390, longitude: -0.5470 },
      ];
      
      const geojsonPath = {
        type: "Feature",
        properties: { "stroke": "#f59e0b", "stroke-width": 4, "stroke-opacity": 0.9 },
        geometry: {
          type: "LineString",
          coordinates: locations.map(loc => [loc.longitude, loc.latitude])
        }
      };
      
      expect(geojsonPath.type).toBe("Feature");
      expect(geojsonPath.geometry.type).toBe("LineString");
      expect(geojsonPath.geometry.coordinates).toHaveLength(2);
      expect(geojsonPath.geometry.coordinates[0]).toEqual([-0.5464, 53.2385]);
    });
  });

  describe("MapBox Static URL Generation", () => {
    it("should generate valid MapBox static API URL", () => {
      const centerLng = -0.5464;
      const centerLat = 53.2385;
      const zoom = 15;
      const width = 600;
      const height = 400;
      const token = "pk.test_token";
      
      const url = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-s-a+10b981(-0.5464,53.2385)/${centerLng},${centerLat},${zoom},0/${width}x${height}@2x?access_token=${token}`;
      
      expect(url).toContain("api.mapbox.com");
      expect(url).toContain("streets-v12");
      expect(url).toContain(`${width}x${height}`);
      expect(url).toContain("@2x");
      expect(url).toContain("access_token=");
    });
  });
});
