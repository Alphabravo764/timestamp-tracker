import { Request, Response } from "express";
import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

// Create S3 client (lazy initialization)
let s3Client: S3Client | null = null;

function getS3Client(): S3Client | null {
    if (s3Client) return s3Client;

    if (!ENV.s3Endpoint || !ENV.s3AccessKeyId || !ENV.s3SecretAccessKey || !ENV.s3BucketName) {
        console.error('[S3 Client] Missing S3 config:', {
            hasEndpoint: !!ENV.s3Endpoint,
            hasAccessKeyId: !!ENV.s3AccessKeyId,
            hasSecretAccessKey: !!ENV.s3SecretAccessKey,
            hasBucketName: !!ENV.s3BucketName,
        });
        return null;
    }

    s3Client = new S3Client({
        endpoint: ENV.s3Endpoint,
        region: ENV.s3Region || "auto",
        credentials: {
            accessKeyId: ENV.s3AccessKeyId,
            secretAccessKey: ENV.s3SecretAccessKey,
        },
        forcePathStyle: true, // Required for Railway/R2 S3-compatible storage
    });

    return s3Client;
}

/**
 * POST /api/upload-url
 * Returns presigned URL for direct photo upload to S3-compatible storage
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

        // Check S3 configuration
        const client = getS3Client();
        if (!client) {
            console.error('[Upload URL] S3 storage not configured');
            return res.status(500).json({ error: "Storage not configured" });
        }

        // Generate photo ID and key
        const photoId = crypto.randomUUID();
        const fileExt = contentType.split('/')[1] === 'jpeg' ? 'jpg' : contentType.split('/')[1];
        const objectKey = `shifts/${pairCode}/photos/${photoId}.${fileExt}`;

        // Generate presigned PUT URL
        const command = new PutObjectCommand({
            Bucket: ENV.s3BucketName,
            Key: objectKey,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(client, command, { expiresIn: 120 });

        // Construct public URL
        const publicUrl = `${ENV.s3Endpoint}/${ENV.s3BucketName}/${objectKey}`;

        console.log('[Upload URL] Generated presigned URL for:', objectKey);

        // Return upload details to client
        return res.json({
            photoId,
            uploadUrl,
            objectKey,
            publicUrl,
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
