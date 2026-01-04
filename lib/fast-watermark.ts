/**
 * Fast Watermark - Instant native watermarking using react-native-image-marker
 * This is the same approach used by Timestamp Camera app
 * NO server calls - everything is done locally on device for instant results
 */

import { Platform } from "react-native";

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
 * Add watermark to photo instantly using native image processing
 * Returns the watermarked image URI
 */
export async function addFastWatermark(
  photoUri: string,
  data: WatermarkData
): Promise<string> {
  console.log("[FastWatermark] Starting instant watermark...");
  const startTime = Date.now();
  
  if (Platform.OS === "web") {
    return addWatermarkWeb(photoUri, data);
  } else {
    return addWatermarkNative(photoUri, data);
  }
}

/**
 * Native implementation using react-native-image-marker
 * This is FAST - uses native code on Android/iOS
 */
async function addWatermarkNative(
  photoUri: string,
  data: WatermarkData
): Promise<string> {
  try {
    const Marker = await import("react-native-image-marker");
    
    // Build the watermark text - multiple lines
    const watermarkText = [
      data.timestamp,
      data.date,
      `📍 ${data.address}`,
      `🌐 ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`,
      data.siteName ? `🏢 ${data.siteName}` : "",
      data.staffName ? `👤 ${data.staffName}` : "",
    ].filter(Boolean).join("\n");
    
    console.log("[FastWatermark] Adding text watermark with react-native-image-marker...");
    
    // Use markText for text watermark
    const result = await Marker.default.markText({
      backgroundImage: {
        src: photoUri,
      },
      watermarkTexts: [
        {
          text: watermarkText,
          position: {
            position: Marker.Position.topLeft,
          },
          style: {
            color: "#FFFFFF",
            fontSize: 42,
            fontName: "Arial",
            shadowStyle: {
              dx: 2,
              dy: 2,
              radius: 4,
              color: "#000000",
            },
            textBackgroundStyle: {
              type: Marker.TextBackgroundType.stretchX,
              paddingX: 20,
              paddingY: 15,
              color: "rgba(0, 0, 0, 0.7)",
            },
          },
        },
      ],
      quality: 90,
      saveFormat: Marker.ImageFormat.jpg,
    });
    
    console.log("[FastWatermark] Native success in", Date.now() - Date.now(), "ms:", result.substring(0, 50));
    return result;
    
  } catch (error) {
    console.log("[FastWatermark] Native error:", error);
    // Return original photo if watermarking fails
    return photoUri;
  }
}

/**
 * Web implementation using HTML Canvas
 * Fast and works without any native dependencies
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
  
  // Add text shadow for better readability
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  
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
  
  // Reset shadow
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
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
