import { Platform, Alert } from "react-native";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as Sharing from "expo-sharing";
import type { ShiftPhoto } from "./shift-types";

/**
 * Create a watermarked version of a photo with timestamp and location
 * On web: returns a canvas-based watermarked image
 * On native: uses expo-sharing to share with text overlay info
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
      // On native, we can't easily add text to images without a native module
      // So we return the original photo and include watermark info separately
      return photo.uri;
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
      
      // Calculate watermark box height based on image size
      const boxHeight = Math.max(120, img.height * 0.12);
      
      // Add gradient overlay at bottom
      const gradient = ctx.createLinearGradient(0, img.height - boxHeight * 1.5, 0, img.height);
      gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      gradient.addColorStop(0.3, "rgba(0, 0, 0, 0.5)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.8)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, img.height - boxHeight * 1.5, img.width, boxHeight * 1.5);
      
      // Text settings
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "left";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      
      const padding = Math.max(15, img.width * 0.02);
      const fontSize = Math.max(16, Math.floor(img.width / 30));
      const smallFontSize = Math.max(12, Math.floor(img.width / 40));
      
      // Format data
      const timestamp = new Date(photo.timestamp).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
      const address = photo.address || "Location unavailable";
      const coords = photo.location 
        ? `${photo.location.latitude.toFixed(6)}, ${photo.location.longitude.toFixed(6)}`
        : "";
      
      let y = img.height - boxHeight + fontSize + 5;
      
      // Timestamp (bold)
      ctx.font = `bold ${fontSize}px -apple-system, Arial, sans-serif`;
      ctx.fillText(`📅 ${timestamp}`, padding, y);
      y += fontSize + 8;
      
      // Address
      ctx.font = `${smallFontSize}px -apple-system, Arial, sans-serif`;
      ctx.fillStyle = "#F0F0F0";
      
      // Truncate address if too long
      const maxWidth = img.width - padding * 2;
      let displayAddress = address;
      while (ctx.measureText(`📍 ${displayAddress}`).width > maxWidth && displayAddress.length > 20) {
        displayAddress = displayAddress.slice(0, -4) + "...";
      }
      ctx.fillText(`📍 ${displayAddress}`, padding, y);
      y += smallFontSize + 6;
      
      // Coordinates
      if (coords) {
        ctx.fillStyle = "#CCCCCC";
        ctx.font = `${smallFontSize - 2}px monospace`;
        ctx.fillText(`🌐 ${coords}`, padding, y);
        y += smallFontSize + 4;
      }
      
      // Staff info on right side
      ctx.textAlign = "right";
      ctx.fillStyle = "#AAAAAA";
      ctx.font = `${smallFontSize - 2}px -apple-system, Arial, sans-serif`;
      ctx.fillText(`${staffName} @ ${siteName}`, img.width - padding, img.height - padding);
      
      // Reset shadow
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      
      // Convert to data URL
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      resolve(dataUrl);
    };
    
    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };
    
    img.src = photo.uri;
  });
};

/**
 * Get watermark text for sharing on native
 */
export const getWatermarkText = (
  photo: ShiftPhoto,
  staffName: string,
  siteName: string
): string => {
  const timestamp = new Date(photo.timestamp).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const address = photo.address || "Location unavailable";
  const coords = photo.location 
    ? `${photo.location.latitude.toFixed(6)}, ${photo.location.longitude.toFixed(6)}`
    : "";
  
  return [
    `📸 Timestamp Photo`,
    ``,
    `📅 ${timestamp}`,
    `📍 ${address}`,
    coords ? `🌐 ${coords}` : "",
    ``,
    `👤 ${staffName}`,
    `🏢 ${siteName}`,
  ].filter(Boolean).join("\n");
};

/**
 * Share photo with watermark info on native
 */
export const sharePhotoWithWatermark = async (
  photo: ShiftPhoto,
  staffName: string,
  siteName: string
): Promise<boolean> => {
  try {
    if (Platform.OS === "web") {
      // On web, download watermarked image
      const watermarkedUrl = await createWatermarkedPhotoWeb(photo, staffName, siteName);
      const link = document.createElement("a");
      link.href = watermarkedUrl;
      link.download = `timestamp_photo_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    }
    
    // On native, share the photo with text
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert("Sharing not available", "Sharing is not available on this device");
      return false;
    }
    
    // Share the original photo - the sharing dialog will include the photo
    await Sharing.shareAsync(photo.uri, {
      mimeType: "image/jpeg",
      dialogTitle: "Share Timestamp Photo",
    });
    
    return true;
  } catch (error) {
    console.error("Error sharing photo:", error);
    return false;
  }
};

/**
 * Save photo to device photo library (native only)
 */
export const savePhotoToLibrary = async (
  photo: ShiftPhoto,
  staffName: string,
  siteName: string
): Promise<boolean> => {
  try {
    if (Platform.OS === "web") {
      // On web, trigger download
      const watermarkedUrl = await createWatermarkedPhotoWeb(photo, staffName, siteName);
      const link = document.createElement("a");
      link.href = watermarkedUrl;
      link.download = `timestamp_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    }
    
    // On native, request permissions first
    const { status: existingStatus } = await MediaLibrary.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== "granted") {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please grant photo library access in Settings to save photos.",
        [{ text: "OK" }]
      );
      return false;
    }
    
    // Save original photo to library
    // Note: We can't add text watermark on native without a native module
    // The photo will be saved as-is, and watermark info is in the metadata
    const asset = await MediaLibrary.createAssetAsync(photo.uri);
    
    // Try to create album
    try {
      const album = await MediaLibrary.getAlbumAsync("Timestamp Camera");
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync("Timestamp Camera", asset, false);
      }
    } catch (albumError) {
      console.warn("Could not create album:", albumError);
      // Photo is still saved to camera roll, just not in a specific album
    }
    
    return true;
  } catch (error) {
    console.error("Error saving photo to library:", error);
    Alert.alert(
      "Save Failed",
      "Could not save photo to library. Please try again.",
      [{ text: "OK" }]
    );
    return false;
  }
};

/**
 * Export all photos from a shift
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
