/**
 * Direct-to-storage photo upload
 * No base64 conversion - uploads binary file directly to object storage
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

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

        // Step 1: Get presigned upload URL
        const urlResponse = await fetch(`${API_BASE_URL}/api/upload-url`, {
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

        // Step 2: Read photo as blob (no base64!)
        const fileResponse = await fetch(photoUri);
        if (!fileResponse.ok) {
            throw new Error('Failed to read photo file');
        }
        const blob = await fileResponse.blob();
        console.log('[Direct Upload] Photo blob size:', Math.round(blob.size / 1024), 'KB');

        // Step 3: Upload directly to storage via presigned URL
        const uploadResponse = await fetch(uploadData.uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'image/jpeg',
            },
            body: blob,
        });

        if (!uploadResponse.ok) {
            throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }

        console.log('[Direct Upload] Upload successful');

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

        const metadataResponse = await fetch(`${API_BASE_URL}/api/sync/photo-metadata`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(metadataPayload),
        });

        if (!metadataResponse.ok) {
            console.error('[Direct Upload] Failed to save metadata, but photo uploaded');
            // Photo is uploaded, metadata save failure is non-critical
        }

        console.log('[Direct Upload] Complete, URL:', uploadData.publicUrl);
        return uploadData.publicUrl;

    } catch (error) {
        console.error('[Direct Upload] Error:', error);
        throw error;
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
