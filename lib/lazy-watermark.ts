/**
 * Lazy watermarking - applies watermark only when viewing/sharing photos
 * This keeps photo capture instant while still providing watermarked output
 */

import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

export interface WatermarkData {
  timestamp: string;
  date: string;
  address: string;
  latitude: number;
  longitude: number;
  staffName: string;
  siteName: string;
}

// Cache watermarked photos to avoid re-processing
const watermarkCache = new Map<string, string>();

/**
 * Get watermarked version of a photo (cached or generate new)
 * Returns original photo URI if watermarking fails
 */
export async function getWatermarkedPhoto(
  photoUri: string,
  watermarkData: WatermarkData
): Promise<string> {
  // Check cache first
  const cacheKey = `${photoUri}_${watermarkData.timestamp}`;
  if (watermarkCache.has(cacheKey)) {
    return watermarkCache.get(cacheKey)!;
  }

  try {
    if (Platform.OS === "web") {
      // Web: use canvas watermark
      const { addWatermarkToPhoto } = await import("@/lib/watermark");
      const watermarkedUri = await addWatermarkToPhoto(photoUri, {
        timestamp: watermarkData.timestamp,
        address: watermarkData.address,
        latitude: watermarkData.latitude,
        longitude: watermarkData.longitude,
        staffName: watermarkData.staffName,
        siteName: watermarkData.siteName,
      });
      
      if (watermarkedUri && watermarkedUri !== photoUri) {
        watermarkCache.set(cacheKey, watermarkedUri);
        return watermarkedUri;
      }
    } else {
      // Native: try server-side watermark API
      const { getApiBaseUrl } = await import("@/constants/oauth");
      const apiUrl = getApiBaseUrl();
      
      // Read photo as base64
      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Call server watermark API
      const response = await fetch(`${apiUrl}/api/watermark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          timestamp: `${watermarkData.timestamp} ${watermarkData.date}`,
          address: watermarkData.address,
          latitude: watermarkData.latitude,
          longitude: watermarkData.longitude,
          staffName: watermarkData.staffName,
          siteName: watermarkData.siteName,
        }),
      });
      
      const result = await response.json();
      
      if (result.success && result.watermarkedBase64) {
        // Save watermarked image to cache directory
        const watermarkedPath = `${FileSystem.cacheDirectory}watermarked_${Date.now()}.jpg`;
        await FileSystem.writeAsStringAsync(watermarkedPath, result.watermarkedBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        watermarkCache.set(cacheKey, watermarkedPath);
        return watermarkedPath;
      }
    }
  } catch (error) {
    console.log("[Lazy Watermark] Failed, using original:", error);
  }

  // Fallback: return original photo
  return photoUri;
}

/**
 * Clear watermark cache (call when memory is low)
 */
export function clearWatermarkCache() {
  watermarkCache.clear();
}
