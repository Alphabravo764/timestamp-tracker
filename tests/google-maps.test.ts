import { describe, it, expect } from "vitest";

describe("Google Maps API Key", () => {
  it("should have GOOGLE_MAPS_API_KEY environment variable set", () => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe("");
    expect(apiKey?.startsWith("AIza")).toBe(true);
  });

  it("should be able to call Geocoding API", async () => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_MAPS_API_KEY not set");
    }

    // Test with a simple geocoding request
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=London&key=${apiKey}`
    );
    
    const data = await response.json();
    
    // Check if API key is valid (not an error response)
    expect(response.ok).toBe(true);
    expect(data.status).not.toBe("REQUEST_DENIED");
    // Valid responses are OK, ZERO_RESULTS, etc.
    expect(["OK", "ZERO_RESULTS"]).toContain(data.status);
  });
});
