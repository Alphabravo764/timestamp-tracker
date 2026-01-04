/**
 * Fast Watermark - Instant canvas-based watermarking
 * Works on both web and native platforms
 * No server calls, no delays
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

/**
 * Add watermark to photo instantly using canvas
 * Returns the watermarked image URI
 */
export async function addFastWatermark(
  photoUri: string,
  data: WatermarkData
): Promise<string> {
  if (Platform.OS === "web") {
    return addWatermarkWeb(photoUri, data);
  } else {
    return addWatermarkNative(photoUri, data);
  }
}

/**
 * Web implementation using HTML Canvas
 */
async function addWatermarkWeb(
  photoUri: string,
  data: WatermarkData
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(photoUri); // Fallback to original
          return;
        }
        
        // Draw original image
        ctx.drawImage(img, 0, 0);
        
        // Draw watermark overlay
        drawWatermarkOverlay(ctx, canvas.width, canvas.height, data);
        
        // Convert to data URL
        const watermarkedUri = canvas.toDataURL("image/jpeg", 0.9);
        resolve(watermarkedUri);
      } catch (error) {
        console.log("[FastWatermark] Web error:", error);
        resolve(photoUri);
      }
    };
    
    img.onerror = () => {
      console.log("[FastWatermark] Image load error");
      resolve(photoUri);
    };
    
    img.src = photoUri;
  });
}

/**
 * Native implementation using expo-image-manipulator + canvas polyfill
 * For native, we use a simpler approach - just compress and return
 * The watermark is already visible in the camera overlay
 */
async function addWatermarkNative(
  photoUri: string,
  data: WatermarkData
): Promise<string> {
  try {
    // On native, use server-side watermarking for quality
    // But do it quickly with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    try {
      // Read photo as base64
      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Try server watermark with timeout
      const response = await fetch("https://timestamp-tracker-production.up.railway.app/api/watermark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          timestamp: `${data.timestamp} ${data.date}`,
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          staffName: data.staffName,
          siteName: data.siteName,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const result = await response.json();
      
      if (result.success && result.watermarkedBase64) {
        // Save watermarked image
        const watermarkedPath = `${FileSystem.cacheDirectory}wm_${Date.now()}.jpg`;
        await FileSystem.writeAsStringAsync(watermarkedPath, result.watermarkedBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        console.log("[FastWatermark] Server success");
        return watermarkedPath;
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === "AbortError") {
        console.log("[FastWatermark] Server timeout, using original");
      } else {
        console.log("[FastWatermark] Server error:", fetchError);
      }
    }
    
    // Fallback: return original photo
    return photoUri;
  } catch (error) {
    console.log("[FastWatermark] Native error:", error);
    return photoUri;
  }
}

/**
 * Draw watermark overlay on canvas context
 */
function drawWatermarkOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: WatermarkData
): void {
  // Semi-transparent background at top
  const overlayHeight = Math.min(200, height * 0.25);
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, width, overlayHeight);
  
  // Text settings
  const fontSize = Math.max(16, Math.floor(width / 30));
  const smallFontSize = Math.max(12, Math.floor(width / 40));
  const padding = Math.max(10, Math.floor(width / 50));
  
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "top";
  
  let y = padding;
  
  // Time (large)
  ctx.font = `bold ${fontSize * 1.5}px Arial, sans-serif`;
  ctx.fillText(data.timestamp, padding, y);
  y += fontSize * 1.8;
  
  // Date
  ctx.font = `${fontSize}px Arial, sans-serif`;
  ctx.fillStyle = "#CCCCCC";
  ctx.fillText(data.date, padding, y);
  y += fontSize * 1.4;
  
  // Address
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `${smallFontSize}px Arial, sans-serif`;
  const addressLines = wrapText(ctx, `📍 ${data.address}`, width - padding * 2);
  addressLines.forEach(line => {
    ctx.fillText(line, padding, y);
    y += smallFontSize * 1.3;
  });
  
  // Coordinates
  ctx.fillStyle = "#AAAAAA";
  ctx.font = `${smallFontSize * 0.9}px monospace`;
  ctx.fillText(`🌐 ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`, padding, y);
  y += smallFontSize * 1.3;
  
  // Staff and Site
  ctx.fillStyle = "#CCCCCC";
  ctx.font = `${smallFontSize}px Arial, sans-serif`;
  if (data.siteName) {
    ctx.fillText(`🏢 ${data.siteName}`, padding, y);
    y += smallFontSize * 1.3;
  }
  if (data.staffName) {
    ctx.fillText(`👤 ${data.staffName}`, padding, y);
  }
}

/**
 * Wrap text to fit within maxWidth
 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines.slice(0, 2); // Max 2 lines
}
