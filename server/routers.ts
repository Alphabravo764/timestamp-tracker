import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { generateShiftPdf } from "./pdf-generator";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    // Dev login for testing (creates/finds user and sets session)
    devLogin: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          name: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const openId = `dev-${input.email}`;

        // Upsert user (create or update)
        await db.upsertUser({
          openId,
          email: input.email,
          name: input.name || "Dev User",
          loginMethod: "dev",
        });

        // Get the user
        const user = await db.getUserByOpenId(openId);
        if (!user) {
          throw new Error("Failed to create user");
        }

        // Create proper JWT session token
        const { sdk } = await import("./_core/sdk.js");
        const { ENV } = await import("./_core/env.js");
        const sessionToken = await sdk.signSession({
          openId: user.openId,
          appId: ENV.appId,
          name: user.name || "Dev User",
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });

        return { user };
      }),
  }),

  // Shift management routes
  shifts: router({
    // Get active shift for current user
    getActive: protectedProcedure.query(async ({ ctx }) => {
      const shift = await db.getActiveShift(ctx.user.id);
      return shift;
    }),

    // Get shift by ID
    getById: protectedProcedure
      .input(z.object({ shiftId: z.number() }))
      .query(async ({ input }) => {
        return await db.getShiftById(input.shiftId);
      }),

    // Get shift by live token (public access)
    getByToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        const shift = await db.getShiftByToken(input.token);
        if (!shift) return null;

        // Get latest location and photos
        const latestLocation = await db.getLatestLocation(shift.id);
        const photos = await db.getShiftPhotos(shift.id);

        return {
          shift,
          latestLocation,
          photos,
        };
      }),

    // Get shift by pair code (public access for watchers)
    getByPairCode: publicProcedure
      .input(z.object({ pairCode: z.string() }))
      .query(async ({ input }) => {
        // Normalize pair code (remove dashes, uppercase)
        const normalizedCode = input.pairCode.replace(/-/g, "").toUpperCase();
        const formattedCode = `${normalizedCode.slice(0, 3)}-${normalizedCode.slice(3, 6)}`;

        const shift = await db.getShiftByPairCode(formattedCode);
        if (!shift) {
          // Also try without formatting
          const shiftAlt = await db.getShiftByPairCode(input.pairCode.toUpperCase());
          if (!shiftAlt) return null;

          const locations = await db.getShiftLocations(shiftAlt.id);
          const photos = await db.getShiftPhotos(shiftAlt.id);
          const latestLocation = await db.getLatestLocation(shiftAlt.id);

          return {
            shift: shiftAlt,
            locations,
            photos,
            latestLocation,
          };
        }

        // Get all shift data
        const locations = await db.getShiftLocations(shift.id);
        const photos = await db.getShiftPhotos(shift.id);
        const latestLocation = await db.getLatestLocation(shift.id);

        return {
          shift,
          locations,
          photos,
          latestLocation,
        };
      }),

    // Start a new shift
    start: protectedProcedure
      .input(
        z.object({
          siteName: z.string().min(1).max(255),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Check if user already has an active shift
        const existingShift = await db.getActiveShift(ctx.user.id);
        if (existingShift) {
          throw new Error("You already have an active shift");
        }

        const liveToken = db.generateToken(32);
        const pairCode = db.generatePairCode();
        const startTime = new Date();

        const shiftId = await db.createShift({
          userId: ctx.user.id,
          siteName: input.siteName,
          notes: input.notes,
          status: "active",
          startTimeUtc: startTime,
          liveToken,
          pairCode,
          pairCodeExpiresAt: null, // Will be set when shift ends
        });

        const shift = await db.getShiftById(shiftId);
        return shift;
      }),

    // End a shift
    end: protectedProcedure
      .input(
        z.object({
          shiftId: z.number(),
          finalPhotoUrl: z.string(),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
          accuracy: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const shift = await db.getShiftById(input.shiftId);
        if (!shift) {
          throw new Error("Shift not found");
        }
        if (shift.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }
        if (shift.status !== "active") {
          throw new Error("Shift is not active");
        }

        const endTime = new Date();

        // Add final photo
        await db.addPhotoEvent({
          shiftId: shift.id,
          fileUrl: input.finalPhotoUrl,
          latitude: input.latitude ? input.latitude.toString() : null,
          longitude: input.longitude ? input.longitude.toString() : null,
          accuracy: input.accuracy ? input.accuracy.toString() : null,
          photoType: "end",
          capturedAt: endTime,
        });

        // End the shift
        await db.endShift(shift.id, endTime);

        return await db.getShiftById(shift.id);
      }),

    // Get user's shift history
    getHistory: protectedProcedure
      .input(z.object({ limit: z.number().optional().default(20) }))
      .query(async ({ ctx, input }) => {
        return await db.getUserShifts(ctx.user.id, input.limit);
      }),
  }),

  // Location tracking routes
  locations: router({
    // Add location points (batch)
    addBatch: protectedProcedure
      .input(
        z.object({
          shiftId: z.number(),
          points: z.array(
            z.object({
              latitude: z.number(),
              longitude: z.number(),
              accuracy: z.number().optional(),
              altitude: z.number().optional(),
              speed: z.number().optional(),
              heading: z.number().optional(),
              capturedAt: z.date(),
              source: z.enum(["gps", "network", "mock"]).optional().default("gps"),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const shift = await db.getShiftById(input.shiftId);
        if (!shift || shift.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        const points = input.points.map((p) => ({
          shiftId: input.shiftId,
          latitude: p.latitude.toString(),
          longitude: p.longitude.toString(),
          accuracy: p.accuracy?.toString() ?? null,
          altitude: p.altitude?.toString() ?? null,
          speed: p.speed?.toString() ?? null,
          heading: p.heading?.toString() ?? null,
          capturedAt: p.capturedAt,
          source: p.source,
        }));

        await db.addLocationPoints(points);
        return { success: true, count: points.length };
      }),

    // Get shift locations
    getShiftLocations: publicProcedure
      .input(z.object({ shiftId: z.number() }))
      .query(async ({ input }) => {
        return await db.getShiftLocations(input.shiftId);
      }),
  }),

  // Photo management routes
  photos: router({
    // Upload photo (accepts base64 data)
    upload: protectedProcedure
      .input(
        z.object({
          shiftId: z.number(),
          photoData: z.string(), // base64 encoded image
          contentType: z.string(),
          latitude: z.number().optional(),
          longitude: z.number().optional(),
          accuracy: z.number().optional(),
          photoType: z.enum(["start", "mid", "end"]).optional().default("mid"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const shift = await db.getShiftById(input.shiftId);
        if (!shift || shift.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        // For now, return a placeholder URL
        // In production, this would upload to S3 via storagePut
        const photoUrl = `https://placeholder.com/photo-${Date.now()}.jpg`;

        const photoId = await db.addPhotoEvent({
          shiftId: input.shiftId,
          fileUrl: photoUrl,
          latitude: input.latitude?.toString() ?? null,
          longitude: input.longitude?.toString() ?? null,
          accuracy: input.accuracy?.toString() ?? null,
          photoType: input.photoType,
          capturedAt: new Date(),
        });

        return { photoId, photoUrl };
      }),



    // Get shift photos
    getShiftPhotos: publicProcedure
      .input(z.object({ shiftId: z.number() }))
      .query(async ({ input }) => {
        return await db.getShiftPhotos(input.shiftId);
      }),
  }),

  // PDF report routes
  reports: router({
    // Generate PDF for a shift
    generate: protectedProcedure
      .input(z.object({ shiftId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const shift = await db.getShiftById(input.shiftId);
        if (!shift) {
          throw new Error("Shift not found");
        }
        if (shift.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        // Check if PDF already exists
        const existingPdf = await db.getShiftPdfReport(input.shiftId);
        if (existingPdf) {
          return { pdfUrl: existingPdf.pdfUrl };
        }

        // Generate new PDF
        const pdfUrl = await generateShiftPdf(input.shiftId);
        return { pdfUrl };
      }),

    // Get PDF for a shift (public access with token)
    get: publicProcedure
      .input(z.object({ shiftId: z.number() }))
      .query(async ({ input }) => {
        return await db.getShiftPdfReport(input.shiftId);
      }),
  }),

  // User profile routes
  profile: router({
    // Get current user profile
    get: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserById(ctx.user.id);
    }),

    // Update user profile
    update: protectedProcedure
      .input(
        z.object({
          name: z.string().optional(),
          phone: z.string().optional(),
          profilePhotoUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.updateUserProfile(ctx.user.id, input);
        return await db.getUserById(ctx.user.id);
      }),
  }),

  // Premium Access Code routes
  premium: router({
    // Validate a code (check if valid and unused)
    validate: publicProcedure
      .input(z.object({ code: z.string().min(1) }))
      .query(async ({ input }) => {
        const result = await db.validatePremiumCode(input.code);
        return result;
      }),

    // Redeem a code (mark as used and bind to device)
    redeem: publicProcedure
      .input(z.object({
        code: z.string().min(1),
        deviceId: z.string().min(1)
      }))
      .mutation(async ({ input }) => {
        const result = await db.redeemPremiumCode(input.code, input.deviceId);
        return result;
      }),

    // Admin: Generate new codes (protected in production)
    generateCodes: publicProcedure.mutation(async () => {
      const codes = await db.generatePremiumCodes();
      return { codes, count: codes.length };
    }),
  }),
});

export type AppRouter = typeof appRouter;
