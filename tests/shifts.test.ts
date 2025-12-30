import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";
import type { User } from "@/shared/types";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(userId: number = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test-${userId}@example.com`,
    name: `Test User ${userId}`,
    phone: null,
    profilePhotoUrl: null,
    loginMethod: "oauth",
    role: "user",
    deviceFingerprint: null,
    subscriptionStatus: "free",
    subscriptionExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {} as any,
    res: {
      cookie: () => {},
      clearCookie: () => {},
    } as any,
  };
}

const testCaller = appRouter.createCaller(createTestContext());

describe("Shift Management", () => {
  let shiftId: number;

  it("should start a new shift", async () => {
    const shift = await testCaller.shifts.start({
      siteName: "Test Site - Main Entrance",
      notes: "Test shift for automated testing",
    });

    expect(shift).toBeDefined();
    if (!shift) throw new Error("Shift not created");
    
    expect(shift.siteName).toBe("Test Site - Main Entrance");
    expect(shift.status).toBe("active");
    expect(shift.liveToken).toBeDefined();
    expect(shift.pairCode).toBeDefined();
    expect(shift.userId).toBe(1);

    shiftId = shift.id;
  });

  it("should get active shift", async () => {
    const activeShift = await testCaller.shifts.getActive();

    expect(activeShift).toBeDefined();
    expect(activeShift?.id).toBe(shiftId);
    expect(activeShift?.status).toBe("active");
  });

  it("should not allow starting multiple shifts", async () => {
    await expect(
      testCaller.shifts.start({
        siteName: "Another Site",
      })
    ).rejects.toThrow("You already have an active shift");
  });

  it("should get shift by ID", async () => {
    const shift = await testCaller.shifts.getById({ shiftId });

    expect(shift).toBeDefined();
    expect(shift?.id).toBe(shiftId);
    expect(shift?.siteName).toBe("Test Site - Main Entrance");
  });

  it("should add location points to shift", async () => {
    const result = await testCaller.locations.addBatch({
      shiftId,
      points: [
        {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
          capturedAt: new Date(),
          source: "gps",
        },
        {
          latitude: 37.7750,
          longitude: -122.4195,
          accuracy: 12,
          capturedAt: new Date(),
          source: "gps",
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
  });

  it("should retrieve shift locations", async () => {
    const locations = await testCaller.locations.getShiftLocations({ shiftId });

    expect(locations).toBeDefined();
    expect(locations.length).toBeGreaterThanOrEqual(2);
    expect(locations[0].latitude).toBeDefined();
    expect(locations[0].longitude).toBeDefined();
  });

  it("should upload a photo to shift", async () => {
    const result = await testCaller.photos.upload({
      shiftId,
      photoData: "base64-encoded-photo-data",
      contentType: "image/jpeg",
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 10,
      photoType: "mid",
    });

    expect(result.photoId).toBeDefined();
    expect(result.photoUrl).toBeDefined();
  });

  it("should retrieve shift photos", async () => {
    const photos = await testCaller.photos.getShiftPhotos({ shiftId });

    expect(photos).toBeDefined();
    expect(photos.length).toBeGreaterThanOrEqual(1);
    expect(photos[0].fileUrl).toBeDefined();
    expect(photos[0].photoType).toBe("mid");
  });

  it("should end a shift", async () => {
    const endedShift = await testCaller.shifts.end({
      shiftId,
      finalPhotoUrl: "https://example.com/final-photo.jpg",
      latitude: 37.7751,
      longitude: -122.4196,
      accuracy: 8,
    });

    expect(endedShift).toBeDefined();
    if (endedShift) {
      expect(endedShift.status).toBe("completed");
      expect(endedShift.endTimeUtc).toBeDefined();
      expect(endedShift.durationMinutes).toBeGreaterThan(0);
    }
  });

  it("should not have active shift after ending", async () => {
    const activeShift = await testCaller.shifts.getActive();
    expect(activeShift).toBeNull();
  });

  it("should retrieve shift by token (public access)", async () => {
    const shift = await testCaller.shifts.getById({ shiftId });
    expect(shift).toBeDefined();

    if (shift) {
      // Use public procedure to get shift by token
      const publicData = await testCaller.shifts.getByToken({
        token: shift.liveToken,
      });

      expect(publicData).toBeDefined();
      expect(publicData?.shift.id).toBe(shiftId);
      expect(publicData?.photos).toBeDefined();
      expect(publicData?.latestLocation).toBeDefined();
    }
  });

  it("should get user shift history", async () => {
    const history = await testCaller.shifts.getHistory({ limit: 10 });

    expect(history).toBeDefined();
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].id).toBe(shiftId);
    expect(history[0].status).toBe("completed");
  });
});

describe("PDF Report Generation", () => {
  let shiftId: number;

  beforeAll(async () => {
    // Create a test shift
    const shift = await testCaller.shifts.start({
      siteName: "PDF Test Site",
      notes: "Testing PDF generation",
    });
    if (!shift) throw new Error("Shift not created");
    shiftId = shift.id;

    // Add some data
    await testCaller.locations.addBatch({
      shiftId,
      points: [
        {
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 15,
          capturedAt: new Date(),
          source: "gps",
        },
      ],
    });

    await testCaller.photos.upload({
      shiftId,
      photoData: "test-photo-data",
      contentType: "image/jpeg",
      latitude: 40.7128,
      longitude: -74.006,
      photoType: "start",
    });

    // End the shift
    await testCaller.shifts.end({
      shiftId,
      finalPhotoUrl: "https://example.com/final.jpg",
      latitude: 40.7129,
      longitude: -74.0061,
    });
  });

  it("should generate PDF report for completed shift", async () => {
    const result = await testCaller.reports.generate({ shiftId });

    expect(result).toBeDefined();
    expect(result.pdfUrl).toBeDefined();
    expect(result.pdfUrl).toContain("shift-");
  });

  it("should return existing PDF if already generated", async () => {
    const result1 = await testCaller.reports.generate({ shiftId });
    const result2 = await testCaller.reports.generate({ shiftId });

    expect(result1.pdfUrl).toBe(result2.pdfUrl);
  });

  it("should retrieve PDF report record", async () => {
    const report = await testCaller.reports.get({ shiftId });

    expect(report).toBeDefined();
    expect(report?.pdfUrl).toBeDefined();
    expect(report?.integrityHash).toBeDefined();
    expect(report?.fileSize).toBeGreaterThan(0);
  });
});
