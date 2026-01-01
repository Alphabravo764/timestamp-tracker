import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { getApiBaseUrl } from "@/constants/oauth";

export interface WatermarkOptions {
  timestamp: string;
  address: string;
  latitude: number;
  longitude: number;
  staffName?: string;
  siteName?: string;
}

// Add watermark to photo - uses server API on native, canvas on web
export const addWatermarkToPhoto = async (
  photoUri: string,
  options: WatermarkOptions
): Promise<string> => {
  try {
    if (Platform.OS === "web") {
      // On web, use canvas to add watermark (works locally)
      return await addWatermarkCanvas(photoUri, options);
    }
    
    // On native iOS/Android, use server-side watermarking
    return await addWatermarkServer(photoUri, options);
  } catch (error) {
    console.error("Watermark error:", error);
    // Return original photo if watermarking fails
    return photoUri;
  }
};

// Server-side watermarking for native platforms
const addWatermarkServer = async (
  photoUri: string,
  options: WatermarkOptions
): Promise<string> => {
  try {
    console.log("[WatermarkServer] Starting server watermark...");
    
    // Read the photo as base64
    let base64Data: string;
    
    if (photoUri.startsWith("data:")) {
      // Already base64
      console.log("[WatermarkServer] Photo is already base64");
      base64Data = photoUri.split(",")[1] || photoUri;
    } else {
      // Read file as base64
      console.log("[WatermarkServer] Reading file as base64:", photoUri.substring(0, 50));
      const fileInfo = await FileSystem.getInfoAsync(photoUri);
      if (!fileInfo.exists) {
        console.error("[WatermarkServer] Photo file does not exist:", photoUri);
        return photoUri;
      }
      
      base64Data = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    
    console.log("[WatermarkServer] Base64 data length:", base64Data.length);
    
    // Call server watermark API
    const apiBaseUrl = getApiBaseUrl();
    console.log("[WatermarkServer] API Base URL:", apiBaseUrl);
    console.log("[WatermarkServer] Calling API...");
    
    const response = await fetch(`${apiBaseUrl}/api/watermark`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageBase64: base64Data,
        timestamp: options.timestamp,
        address: options.address,
        latitude: options.latitude,
        longitude: options.longitude,
        staffName: options.staffName,
        siteName: options.siteName,
      }),
    });
    
    console.log("[WatermarkServer] API response status:", response.status);
    
    if (!response.ok) {
      console.error("[WatermarkServer] API error:", response.status);
      // Return original as data URI if server fails
      return `data:image/jpeg;base64,${base64Data}`;
    }
    
    const result = await response.json();
    console.log("[WatermarkServer] API result success:", result.success);
    
    if (result.success && result.watermarkedBase64) {
      console.log("[WatermarkServer] Got watermarked image, length:", result.watermarkedBase64.length);
      // Return watermarked image as data URI
      return `data:image/jpeg;base64,${result.watermarkedBase64}`;
    }
    
    console.error("[WatermarkServer] API returned error:", result.error);
    // Return original as data URI
    return `data:image/jpeg;base64,${base64Data}`;
  } catch (error) {
    console.error("Server watermark error:", error);
    
    // Try to return original as data URI
    try {
      if (photoUri.startsWith("data:")) {
        return photoUri;
      }
      const base64Data = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:image/jpeg;base64,${base64Data}`;
    } catch {
      return photoUri;
    }
  }
};

// Generate watermarked image for sharing/export (works on all platforms)
export const generateWatermarkedImage = async (
  photoUri: string,
  options: WatermarkOptions
): Promise<string> => {
  // This function creates a watermarked version for sharing
  return await addWatermarkToPhoto(photoUri, options);
};

// Web canvas watermark - creates actual burned-in watermark
const addWatermarkCanvas = async (
  photoUri: string,
  options: WatermarkOptions
): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          resolve(photoUri);
          return;
        }
        
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw original image
        ctx.drawImage(img, 0, 0);
        
        // Add semi-transparent background for text at bottom
        const boxHeight = Math.max(140, canvas.height * 0.15);
        const gradient = ctx.createLinearGradient(0, canvas.height - boxHeight, 0, canvas.height);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(0.2, "rgba(0,0,0,0.6)");
        gradient.addColorStop(1, "rgba(0,0,0,0.85)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, canvas.height - boxHeight, canvas.width, boxHeight);
        
        // Text settings
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "left";
        const padding = Math.max(20, canvas.width * 0.03);
        let y = canvas.height - boxHeight + 35;
        
        // Timestamp (large, bold)
        const fontSize = Math.max(28, Math.floor(canvas.width / 25));
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, Arial, sans-serif`;
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillText(options.timestamp, padding, y);
        y += fontSize + 10;
        
        // Reset shadow for smaller text
        ctx.shadowBlur = 2;
        
        // Address (medium)
        const mediumFont = Math.max(20, Math.floor(canvas.width / 35));
        ctx.font = `${mediumFont}px -apple-system, BlinkMacSystemFont, Arial, sans-serif`;
        ctx.fillStyle = "#F0F0F0";
        
        // Truncate address if too long
        const maxWidth = canvas.width - padding * 2;
        let address = options.address || "Location unavailable";
        while (ctx.measureText(address).width > maxWidth && address.length > 10) {
          address = address.slice(0, -4) + "...";
        }
        ctx.fillText(`📍 ${address}`, padding, y);
        y += mediumFont + 8;
        
        // GPS Coordinates (small)
        const smallFont = Math.max(16, Math.floor(canvas.width / 45));
        ctx.font = `${smallFont}px -apple-system, BlinkMacSystemFont, Arial, sans-serif`;
        ctx.fillStyle = "#CCCCCC";
        const coords = `🌐 ${options.latitude.toFixed(6)}, ${options.longitude.toFixed(6)}`;
        ctx.fillText(coords, padding, y);
        
        // Add staff/site info on the right side if provided
        if (options.staffName || options.siteName) {
          ctx.textAlign = "right";
          ctx.fillStyle = "#AAAAAA";
          ctx.font = `${smallFont}px -apple-system, BlinkMacSystemFont, Arial, sans-serif`;
          const rightX = canvas.width - padding;
          let rightY = canvas.height - boxHeight + 35;
          
          if (options.siteName) {
            ctx.fillText(`🏢 ${options.siteName}`, rightX, rightY);
            rightY += smallFont + 6;
          }
          if (options.staffName) {
            ctx.fillText(`👤 ${options.staffName}`, rightX, rightY);
          }
        }
        
        // Reset shadow
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        
        // Convert to data URL with high quality
        const watermarkedUri = canvas.toDataURL("image/jpeg", 0.92);
        resolve(watermarkedUri);
      };
      
      img.onerror = () => {
        console.error("Failed to load image for watermark");
        resolve(photoUri);
      };
      
      img.src = photoUri;
    } catch (error) {
      console.error("Canvas watermark error:", error);
      resolve(photoUri);
    }
  });
};

// Format timestamp for watermark display
export const formatWatermarkTimestamp = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  };
  return date.toLocaleString("en-GB", options);
};

// Generate watermark text for sharing (when image watermark not possible)
export const generateWatermarkText = (options: WatermarkOptions): string => {
  const lines = [
    `📸 Timestamp Photo`,
    ``,
    `📅 ${options.timestamp}`,
    `📍 ${options.address || "Location unavailable"}`,
    `🌐 ${options.latitude.toFixed(6)}, ${options.longitude.toFixed(6)}`,
  ];
  
  if (options.siteName) {
    lines.push(`🏢 ${options.siteName}`);
  }
  if (options.staffName) {
    lines.push(`👤 ${options.staffName}`);
  }
  
  return lines.join("\n");
};
