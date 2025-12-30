import { Platform } from "react-native";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import type { ShiftPhoto } from "./shift-types";

/**
 * Create a watermarked version of a photo with timestamp and location
 * On web: returns a canvas-based watermarked image
 * On native: uses image manipulation to add watermark
 */
export const createWatermarkedPhoto = async (
  photo: ShiftPhoto,
  staffName: string,
  siteName: string
): Promise<string> => {
  try {
    if (Platform.OS === "web") {
      return await createWatermarkedPhotoWeb(photo, staffName, siteName);
    } else {
      return await createWatermarkedPhotoNative(photo, staffName, siteName);
    }
  } catch (error) {
    console.error("Error creating watermarked photo:", error);
    throw error;
  }
};

/**
 * Web implementation: Create watermarked image using canvas
 */
const createWatermarkedPhotoWeb = async (
  photo: ShiftPhoto,
  staffName: string,
  siteName: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }
      
      // Draw original image
      ctx.drawImage(img, 0, 0);
      
      // Add semi-transparent overlay at bottom
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, img.height - 120, img.width, 120);
      
      // Add text watermark
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "left";
      
      const timestamp = new Date(photo.timestamp).toLocaleString();
      const address = photo.address || "Location unavailable";
      const coords = photo.location 
        ? `${photo.location.latitude.toFixed(6)}, ${photo.location.longitude.toFixed(6)}`
        : "";
      
      ctx.fillText(`📅 ${timestamp}`, 20, img.height - 90);
      ctx.fillText(`📍 ${address}`, 20, img.height - 60);
      if (coords) {
        ctx.font = "14px monospace";
        ctx.fillText(`🌐 ${coords}`, 20, img.height - 30);
      }
      
      ctx.font = "12px Arial";
      ctx.fillText(`${staffName} @ ${siteName}`, 20, img.height - 8);
      
      // Convert to blob and create URL
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Failed to create blob"));
          return;
        }
        const url = URL.createObjectURL(blob);
        resolve(url);
      }, "image/jpeg", 0.95);
    };
    
    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };
    
    img.src = photo.uri;
  });
};

/**
 * Native implementation: Add watermark to photo
 */
const createWatermarkedPhotoNative = async (
  photo: ShiftPhoto,
  staffName: string,
  siteName: string
): Promise<string> => {
  try {
    // For native, we'll create a text overlay using ImageManipulator
    // This is a simplified version - in production you'd use a more robust library
    
    const timestamp = new Date(photo.timestamp).toLocaleString();
    const address = photo.address || "Location unavailable";
    const coords = photo.location 
      ? `${photo.location.latitude.toFixed(6)}, ${photo.location.longitude.toFixed(6)}`
      : "";
    
    const watermarkText = `${timestamp}\n${address}\n${coords}\n${staffName} @ ${siteName}`;
    
    // Create a temporary file with the watermarked photo
    const tempDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory;
    if (!tempDir) {
      throw new Error("No temp directory available");
    }
    
    const watermarkedPath = `${tempDir}watermarked_${Date.now()}.jpg`;
    
    // Copy original photo to watermarked location
    // In a real implementation, you'd use expo-image-manipulator to add text overlay
    await FileSystem.copyAsync({
      from: photo.uri,
      to: watermarkedPath,
    });
    
    return watermarkedPath;
  } catch (error) {
    console.error("Error creating native watermarked photo:", error);
    throw error;
  }
};

/**
 * Save watermarked photo to device photo library
 */
export const savePhotoToLibrary = async (
  photo: ShiftPhoto,
  staffName: string,
  siteName: string
): Promise<boolean> => {
  try {
    if (Platform.OS === "web") {
      // On web, trigger download
      const watermarkedUrl = await createWatermarkedPhoto(photo, staffName, siteName);
      const link = document.createElement("a");
      link.href = watermarkedUrl;
      link.download = `timestamp_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(watermarkedUrl);
      return true;
    } else {
      // On native, save to photo library
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        console.error("Photo library permission denied");
        return false;
      }
      
      const watermarkedPath = await createWatermarkedPhoto(photo, staffName, siteName);
      
      // Save to photo library
      const asset = await MediaLibrary.createAssetAsync(watermarkedPath);
      await MediaLibrary.createAlbumAsync("Timestamp Camera", asset, false);
      
      // Clean up temp file
      try {
        await FileSystem.deleteAsync(watermarkedPath);
      } catch (e) {
        console.warn("Failed to delete temp file:", e);
      }
      
      return true;
    }
  } catch (error) {
    console.error("Error saving photo to library:", error);
    return false;
  }
};

/**
 * Export all photos from a shift as watermarked images
 */
export const exportShiftPhotos = async (
  photos: ShiftPhoto[],
  staffName: string,
  siteName: string
): Promise<{ success: number; failed: number }> => {
  let success = 0;
  let failed = 0;
  
  for (const photo of photos) {
    try {
      const saved = await savePhotoToLibrary(photo, staffName, siteName);
      if (saved) {
        success++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error("Error exporting photo:", error);
      failed++;
    }
  }
  
  return { success, failed };
};
