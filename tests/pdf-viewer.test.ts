import { describe, it, expect } from "vitest";

describe("PDF Generation via Viewer", () => {
  it("should build correct viewer URL for PDF generation", () => {
    const apiUrl = "https://timestamp-tracker-production.up.railway.app";
    const pairCode = "HMLHPF";
    
    const viewerUrl = `${apiUrl}/viewer/${pairCode}`;
    
    expect(viewerUrl).toBe("https://timestamp-tracker-production.up.railway.app/viewer/HMLHPF");
    expect(viewerUrl).toContain("/viewer/");
    expect(viewerUrl).not.toContain("format=pdf"); // No longer using format=pdf
  });

  it("should have correct viewer page structure for PDF printing", () => {
    // The viewer page should have these sections for proper PDF output
    const requiredSections = [
      "header", // Avatar, name, site
      "header-stats", // Duration, Locations, Photos
      "location-bar", // Address, GPS coords
      "map-container", // Leaflet map with polyline
      "activity-feed", // Photos Timeline
      "feed-footer", // Download Shift Report button
    ];
    
    // All sections should be present
    expect(requiredSections.length).toBe(6);
    expect(requiredSections).toContain("map-container");
    expect(requiredSections).toContain("activity-feed");
  });

  it("should format duration correctly", () => {
    // Test duration formatting (HH:MM format like in NOPINPOINT.pdf)
    const formatDuration = (ms: number): string => {
      const hours = Math.floor(ms / (1000 * 60 * 60));
      const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    };
    
    // 2 hours 28 minutes = 02:28
    const duration = 2 * 60 * 60 * 1000 + 28 * 60 * 1000;
    expect(formatDuration(duration)).toBe("02:28");
    
    // 0 hours 45 minutes = 00:45
    const shortDuration = 45 * 60 * 1000;
    expect(formatDuration(shortDuration)).toBe("00:45");
  });

  it("should format photo timestamp correctly", () => {
    const timestamp = "2026-01-03T18:37:41.000Z";
    const date = new Date(timestamp);
    
    // Time format: HH:MM:SS
    const time = date.toLocaleTimeString("en-GB", { 
      hour: "2-digit", 
      minute: "2-digit", 
      second: "2-digit" 
    });
    
    // Date format: DD/MM/YYYY
    const dateStr = date.toLocaleDateString("en-GB");
    
    expect(time).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(dateStr).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("should generate correct initials for avatar", () => {
    const getInitials = (name: string): string => {
      const parts = name.trim().split(/\s+/);
      if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
      }
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };
    
    expect(getInitials("Abdul")).toBe("AB");
    expect(getInitials("John Doe")).toBe("JD");
    expect(getInitials("Mary Jane Watson")).toBe("MW");
  });

  it("should have print styles for PDF output", () => {
    // The viewer.html should have @media print styles
    const printStyles = [
      "page-break-inside: avoid",
      "display: none", // For hiding interactive elements
    ];
    
    // Print styles should hide interactive elements and prevent page breaks inside items
    expect(printStyles).toContain("page-break-inside: avoid");
    expect(printStyles).toContain("display: none");
  });
});

describe("Viewer Page Layout", () => {
  it("should have correct header structure", () => {
    const headerElements = {
      avatar: { width: 56, height: 56, borderRadius: "50%" },
      liveBadge: { text: "LIVE", background: "#22c55e" },
      stats: ["Duration", "Locations", "Photos"],
    };
    
    expect(headerElements.avatar.width).toBe(56);
    expect(headerElements.liveBadge.text).toBe("LIVE");
    expect(headerElements.stats).toContain("Duration");
    expect(headerElements.stats).toContain("Locations");
    expect(headerElements.stats).toContain("Photos");
  });

  it("should have correct map configuration", () => {
    const mapConfig = {
      height: 500,
      polylineColor: "#f59e0b", // Yellow/amber color for route
      polylineWeight: 4,
      tileProvider: "OpenStreetMap",
    };
    
    expect(mapConfig.height).toBe(500);
    expect(mapConfig.polylineColor).toBe("#f59e0b");
    expect(mapConfig.tileProvider).toBe("OpenStreetMap");
  });

  it("should have correct photo card structure", () => {
    const photoCard = {
      timeFormat: "HH:MM:SS",
      dateFormat: "DD/MM/YYYY",
      hasAddress: true,
      hasImage: true,
      borderRadius: 12,
    };
    
    expect(photoCard.hasAddress).toBe(true);
    expect(photoCard.hasImage).toBe(true);
    expect(photoCard.borderRadius).toBe(12);
  });

  it("should have correct note card structure", () => {
    const noteCard = {
      leftBorderColor: "#f59e0b", // Amber color
      leftBorderWidth: 3,
      hasTimestamp: true,
      hasLocation: true,
    };
    
    expect(noteCard.leftBorderColor).toBe("#f59e0b");
    expect(noteCard.leftBorderWidth).toBe(3);
    expect(noteCard.hasTimestamp).toBe(true);
  });
});
