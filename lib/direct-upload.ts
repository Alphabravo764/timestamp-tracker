/**
 * Direct-to-storage photo upload
 * No base64 conversion - uploads binary file directly to object storage
 */

import { getApiBaseUrl } from "@/constants/oauth";

interface UploadUrlResponse {
    photoId: string;
    uploadUrl: string;
    objectKey: string;
    publicUrl: string;
    expiresIn: number;
}

interface PhotoMetadata {
    shiftId: string;
    pairCode: string;
    photoId: string;
    url: string;
    timestamp: string;
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    address?: string;
}

/**
 * Upload photo directly to object storage (no base64)
 * @param photoUri - Local file URI from camera
 * @param metadata - Photo metadata (location, timestamp, etc)
 * @returns Public URL of uploaded photo
 */
import * as FileSystem from 'expo-file-system/legacy';
// ... (other imports)

export async function uploadPhotoDirect(
    photoUri: string,
    metadata: {
        shiftId: string;
        pairCode: string;
        timestamp: string;
        latitude?: number;
        longitude?: number;
        accuracy?: number;
        address?: string;
    }
): Promise<string> {
    try {
        console.log('[Direct Upload] Starting upload for:', metadata.pairCode);
        console.log('[Direct Upload] photoPath:', photoUri);
        console.log('[Direct Upload] isFileUri:', photoUri?.startsWith('file://'));

        // Step 1: Get presigned upload URL
        const urlResponse = await fetch(`${getApiBaseUrl()}/api/upload-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shiftId: metadata.shiftId,
                pairCode: metadata.pairCode,
                contentType: 'image/jpeg',
            }),
        });

        if (!urlResponse.ok) {
            const error = await urlResponse.text();
            throw new Error(`Failed to get upload URL: ${error}`);
        }

        const uploadData: UploadUrlResponse = await urlResponse.json();
        console.log('[Direct Upload] Got upload URL, photoId:', uploadData.photoId);
        console.log('[Direct Upload] Upload URL HTTPS:', uploadData.uploadUrl.startsWith('https://'));

        // Step 2 & 3: Upload directly using FileSystem (more robust for RN)
        const uploadResult = await FileSystem.uploadAsync(uploadData.uploadUrl, photoUri, {
            httpMethod: 'PUT',
            uploadType: 0 as any, // FileSystem.FileSystemUploadType.BINARY_CONTENT
            headers: {
                'Content-Type': 'image/jpeg',
            },
        });

        if (uploadResult.status < 200 || uploadResult.status >= 300) {
            throw new Error(`Upload failed: ${uploadResult.status} ${uploadResult.body?.slice(0, 200)}`);
        }

        console.log('[Direct Upload] Upload successful (FileSystem.uploadAsync)');

        // Step 4: Get device ID for premium validation
        const { getDeviceId } = await import('@/lib/settings-storage');
        const deviceId = await getDeviceId();

        // Step 5: Save metadata to database with deviceId for server-side premium check
        const metadataPayload: PhotoMetadata & { deviceId: string } = {
            shiftId: metadata.shiftId,
            pairCode: metadata.pairCode,
            photoId: uploadData.photoId,
            url: uploadData.publicUrl,
            timestamp: metadata.timestamp,
            latitude: metadata.latitude,
            longitude: metadata.longitude,
            accuracy: metadata.accuracy,
            address: metadata.address,
            deviceId, // For server-side premium validation
        };

        // 🔍 Log metadata payload for debugging
        console.log('[Direct Upload] 🟡 SENDING METADATA:', JSON.stringify({
            pairCode: metadataPayload.pairCode,
            photoId: metadataPayload.photoId,
            url: metadataPayload.url?.substring(0, 60) + '...',
        }));

        const metadataResponse = await fetch(`${getApiBaseUrl()}/api/sync/photo-metadata`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(metadataPayload),
        });

        if (!metadataResponse.ok) {
            const errorBody = await metadataResponse.text().catch(() => '');
            console.error('[Direct Upload] Metadata save failed:', {
                status: metadataResponse.status,
                statusText: metadataResponse.statusText,
                body: errorBody,
                endpoint: `${getApiBaseUrl()}/api/sync/photo-metadata`,
            });
            // Photo is uploaded, metadata save failure is non-critical for display
            // Return the URL anyway - photo was saved to storage
        }

        console.log('[Direct Upload] Complete, URL:', uploadData.publicUrl);
        return uploadData.publicUrl;

    } catch (error: any) {
        console.error('[Direct Upload] Error name:', error?.name);
        console.error('[Direct Upload] Error message:', error?.message);
        console.error('[Direct Upload] Raw error:', error);
        // Don't throw - return empty string so UI doesn't crash
        return '';
    }
}

/**
 * Fallback: Convert photo to base64 for legacy sync
 * Only use this as fallback if direct upload fails
 */
export async function photoToBase64DataUri(
    uri: string,
    maxWidth: number = 1200,
    quality: number = 0.8
): Promise<string | null> {
    try {
        const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');

        const result = await manipulateAsync(
            uri,
            [{ resize: { width: maxWidth } }],
            { compress: quality, format: SaveFormat.JPEG, base64: true }
        );

        if (!result.base64) return null;
        return `data:image/jpeg;base64,${result.base64}`;
    } catch (error) {
        console.error('[Base64 Fallback] Error:', error);
        return null;
    }
}
