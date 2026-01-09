import { Request, Response } from "express";
import crypto from "crypto";
import { ENV } from "./_core/env";
import { monitor } from "./monitoring.js";

// Rate limiting map - in production, use Redis
const uploadRequestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // 30 uploads per minute per IP

function checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const record = uploadRequestCounts.get(identifier);

    if (!record || now > record.resetAt) {
        uploadRequestCounts.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }

    if (record.count >= MAX_REQUESTS_PER_WINDOW) {
        return false;
    }

    record.count++;
    return true;
}

/**
 * POST /api/upload-url
 * Returns presigned URL for direct photo upload to object storage
 */
export async function createUploadUrl(req: Request, res: Response) {
    try {
        const { shiftId, contentType, pairCode } = req.body;

        // Validation
        if (!shiftId || !pairCode) {
            return res.status(400).json({ error: "shiftId and pairCode required" });
        }

        // Content type validation
        const validContentTypes = /^image\/(jpeg|jpg|png|webp)$/;
        if (!contentType || !validContentTypes.test(contentType)) {
            return res.status(400).json({
                error: "Invalid content type. Must be image/jpeg, image/png, or image/webp"
            });
        }

        // Rate limiting by IP + pairCode
        const identifier = `${req.ip}_${pairCode}`;
        if (!checkRateLimit(identifier)) {
            return res.status(429).json({
                error: "Rate limit exceeded. Please wait before uploading more photos."
            });
        }

        // Track upload request
        monitor.recordUpload();

        // Generate photo ID and key
        const photoId = crypto.randomUUID();
        const fileExt = contentType.split('/')[1] === 'jpeg' ? 'jpg' : contentType.split('/')[1];
        const objectKey = `shifts/${pairCode}/photos/${photoId}.${fileExt}`;

        // Get presigned upload URL from Forge storage
        const forgeApiUrl = ENV.forgeApiUrl;
        const forgeApiKey = ENV.forgeApiKey;

        if (!forgeApiUrl || !forgeApiKey) {
            console.error('[Upload URL] Storage credentials not configured');
            return res.status(500).json({ error: "Storage not configured" });
        }

        // Build upload URL (Forge storage API)
        const uploadApiUrl = new URL('v1/storage/upload', forgeApiUrl.replace(/\/+$/, '') + '/');
        uploadApiUrl.searchParams.set('path', objectKey);

        // Get presigned URL by calling storage API
        const presignResponse = await fetch(uploadApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${forgeApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contentType,
                expiresIn: 120, // 2 minutes
            }),
        });

        if (!presignResponse.ok) {
            console.error('[Upload URL] Failed to get presigned URL:', await presignResponse.text());
            return res.status(500).json({ error: "Failed to generate upload URL" });
        }

        const presignData = await presignResponse.json();

        // Return upload details to client
        return res.json({
            photoId,
            uploadUrl: presignData.uploadUrl || uploadApiUrl.toString(),
            objectKey,
            publicUrl: presignData.publicUrl || `${forgeApiUrl}/storage/${objectKey}`,
            expiresIn: 120,
        });

    } catch (error) {
        console.error('[Upload URL] Error:', error);
        return res.status(500).json({
            error: "Failed to create upload URL",
            message: error instanceof Error ? error.message : String(error)
        });
    }
}
