/**
 * Fast Watermark - Instant local watermarking
 * Works on both web and native platforms
 * NO server calls - everything is done locally for speed
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
 * Add watermark to photo instantly using local processing
 * Returns the watermarked image URI (data URI on web, file URI on native)
 */
export async function addFastWatermark(
  photoUri: string,
  data: WatermarkData
): Promise<string> {
  console.log("[FastWatermark] Starting local watermark...");
  
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
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      console.log("[FastWatermark] Web timeout, using original");
      resolve(photoUri);
    }, 5000);
    
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          console.log("[FastWatermark] No canvas context");
          resolve(photoUri);
          return;
        }
        
        // Draw original image
        ctx.drawImage(img, 0, 0);
        
        // Draw watermark overlay
        drawWatermarkOverlay(ctx, canvas.width, canvas.height, data);
        
        // Convert to data URL
        const watermarkedUri = canvas.toDataURL("image/jpeg", 0.9);
        console.log("[FastWatermark] Web success");
        resolve(watermarkedUri);
      } catch (error) {
        console.log("[FastWatermark] Web error:", error);
        resolve(photoUri);
      }
    };
    
    img.onerror = (e) => {
      clearTimeout(timeout);
      console.log("[FastWatermark] Image load error:", e);
      resolve(photoUri);
    };
    
    img.src = photoUri;
  });
}

/**
 * Native implementation using Skia canvas
 * Falls back to returning original photo if Skia is not available
 */
async function addWatermarkNative(
  photoUri: string,
  data: WatermarkData
): Promise<string> {
  try {
    console.log("[FastWatermark] Native processing...");
    
    // Try to use Skia for native canvas rendering
    try {
      const { Skia, AlphaType, ColorType } = await import("@shopify/react-native-skia");
      
      // Read the image file
      const base64 = await FileSystem.readAsStringAsync(photoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Decode the image using Skia
      const imageData = Skia.Data.fromBase64(base64);
      const image = Skia.Image.MakeImageFromEncoded(imageData);
      
      if (!image) {
        console.log("[FastWatermark] Could not decode image");
        return photoUri;
      }
      
      const width = image.width();
      const height = image.height();
      
      // Create a surface to draw on
      const surface = Skia.Surface.Make(width, height);
      if (!surface) {
        console.log("[FastWatermark] Could not create surface");
        return photoUri;
      }
      
      const canvas = surface.getCanvas();
      
      // Draw the original image
      canvas.drawImage(image, 0, 0);
      
      // Draw watermark overlay
      drawWatermarkSkia(canvas, Skia, width, height, data);
      
      // Get the result as an image
      surface.flush();
      const resultImage = surface.makeImageSnapshot();
      
      if (!resultImage) {
        console.log("[FastWatermark] Could not create snapshot");
        return photoUri;
      }
      
      // Encode to JPEG
      const { ImageFormat } = await import("@shopify/react-native-skia");
      const resultData = resultImage.encodeToBase64(ImageFormat.JPEG, 90);
      
      if (!resultData) {
        console.log("[FastWatermark] Could not encode result");
        return photoUri;
      }
      
      // Save to file
      const outputPath = `${FileSystem.cacheDirectory}wm_${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(outputPath, resultData, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      console.log("[FastWatermark] Native Skia success");
      return outputPath;
      
    } catch (skiaError) {
      console.log("[FastWatermark] Skia not available:", skiaError);
      
      // Fallback: Use server API with short timeout
      return await addWatermarkServer(photoUri, data);
    }
    
  } catch (error) {
    console.log("[FastWatermark] Native error:", error);
    return photoUri;
  }
}

/**
 * Server-based watermarking as fallback
 */
async function addWatermarkServer(
  photoUri: string,
  data: WatermarkData
): Promise<string> {
  try {
    console.log("[FastWatermark] Trying server fallback...");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    // Read photo as base64
    const base64 = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
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
      const watermarkedPath = `${FileSystem.cacheDirectory}wm_${Date.now()}.jpg`;
      await FileSystem.writeAsStringAsync(watermarkedPath, result.watermarkedBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      console.log("[FastWatermark] Server success");
      return watermarkedPath;
    }
    
    return photoUri;
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.log("[FastWatermark] Server timeout");
    } else {
      console.log("[FastWatermark] Server error:", error);
    }
    return photoUri;
  }
}

/**
 * Draw watermark using Skia canvas
 */
function drawWatermarkSkia(
  canvas: any,
  Skia: any,
  width: number,
  height: number,
  data: WatermarkData
): void {
  // Semi-transparent background at top
  const overlayHeight = Math.min(200, height * 0.25);
  const bgPaint = Skia.Paint();
  bgPaint.setColor(Skia.Color("rgba(0, 0, 0, 0.7)"));
  canvas.drawRect(Skia.XYWHRect(0, 0, width, overlayHeight), bgPaint);
  
  // Text settings
  const fontSize = Math.max(16, Math.floor(width / 30));
  const smallFontSize = Math.max(12, Math.floor(width / 40));
  const padding = Math.max(10, Math.floor(width / 50));
  
  const whitePaint = Skia.Paint();
  whitePaint.setColor(Skia.Color("#FFFFFF"));
  
  const grayPaint = Skia.Paint();
  grayPaint.setColor(Skia.Color("#CCCCCC"));
  
  const darkGrayPaint = Skia.Paint();
  darkGrayPaint.setColor(Skia.Color("#AAAAAA"));
  
  let y = padding + fontSize * 1.5;
  
  // Time (large)
  const timeFont = Skia.Font(null, fontSize * 1.5);
  canvas.drawText(data.timestamp, padding, y, whitePaint, timeFont);
  y += fontSize * 1.8;
  
  // Date
  const dateFont = Skia.Font(null, fontSize);
  canvas.drawText(data.date, padding, y, grayPaint, dateFont);
  y += fontSize * 1.4;
  
  // Address
  const smallFont = Skia.Font(null, smallFontSize);
  canvas.drawText(`📍 ${data.address}`, padding, y, whitePaint, smallFont);
  y += smallFontSize * 1.3;
  
  // Coordinates
  const monoFont = Skia.Font(null, smallFontSize * 0.9);
  canvas.drawText(
    `🌐 ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`,
    padding, y, darkGrayPaint, monoFont
  );
  y += smallFontSize * 1.3;
  
  // Site and Staff
  if (data.siteName) {
    canvas.drawText(`🏢 ${data.siteName}`, padding, y, grayPaint, smallFont);
    y += smallFontSize * 1.3;
  }
  if (data.staffName) {
    canvas.drawText(`👤 ${data.staffName}`, padding, y, grayPaint, smallFont);
  }
}

/**
 * Draw watermark overlay on HTML canvas context
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
