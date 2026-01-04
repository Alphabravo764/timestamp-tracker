/**
 * Burn watermark into photo - ONLY used during export/PDF generation
 * Never call this during photo capture (it's slow and blocks UI)
 */

import { Platform } from "react-native";

export interface WatermarkData {
  timestamp: string;
  date: string;
  address: string;
  latitude: number;
  longitude: number;
  staffName?: string;
  siteName?: string;
}

/**
 * Burn watermark into photo for export/PDF
 * This is a slow operation (1-3 seconds) - only use for final output
 */
export async function burnWatermark(
  photoUri: string,
  watermarkData: WatermarkData
): Promise<string> {
  if (Platform.OS === "web") {
    return burnWatermarkWeb(photoUri, watermarkData);
  } else {
    // On native, try react-native-image-marker first
    try {
      const Marker = await import("react-native-image-marker");
      return await burnWatermarkNative(photoUri, watermarkData, Marker.default);
    } catch (error) {
      console.log("[BurnWatermark] Native marker not available, returning original");
      return photoUri;
    }
  }
}

/**
 * Web: Use canvas to burn watermark
 */
async function burnWatermarkWeb(
  photoUri: string,
  watermarkData: WatermarkData
): Promise<string> {
  return new Promise((resolve) => {
    const img = new (window as any).Image() as HTMLImageElement;
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          resolve(photoUri);
          return;
        }
        
        // Draw photo
        ctx.drawImage(img, 0, 0);
        
        // Draw watermark box
        const padding = 20;
        const boxHeight = 160;
        const boxY = canvas.height - boxHeight - padding;
        
        // Semi-transparent black background
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.fillRect(padding, boxY, canvas.width - padding * 2, boxHeight);
        
        // Text styling
        ctx.fillStyle = "#FFFFFF";
        ctx.textBaseline = "top";
        
        let y = boxY + 15;
        
        // Timestamp (large)
        ctx.font = "bold 32px monospace";
        ctx.fillText(watermarkData.timestamp, padding + 15, y);
        y += 40;
        
        // Date
        ctx.font = "600 18px monospace";
        ctx.fillText(watermarkData.date, padding + 15, y);
        y += 25;
        
        // Location
        ctx.font = "14px sans-serif";
        ctx.fillText(`📍 ${watermarkData.address}`, padding + 15, y);
        y += 20;
        
        // Coordinates
        ctx.font = "13px monospace";
        ctx.fillText(
          `🌐 ${watermarkData.latitude.toFixed(6)}, ${watermarkData.longitude.toFixed(6)}`,
          padding + 15,
          y
        );
        
        // Staff/Site if available
        if (watermarkData.staffName || watermarkData.siteName) {
          y += 20;
          ctx.font = "12px sans-serif";
          if (watermarkData.staffName) {
            ctx.fillText(`👤 ${watermarkData.staffName}`, padding + 15, y);
          }
          if (watermarkData.siteName) {
            ctx.fillText(
              `🏢 ${watermarkData.siteName}`,
              padding + 15 + (watermarkData.staffName ? 200 : 0),
              y
            );
          }
        }
        
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      } catch (error) {
        console.log("[BurnWatermark] Web canvas error:", error);
        resolve(photoUri);
      }
    };
    
    img.onerror = () => resolve(photoUri);
    setTimeout(() => resolve(photoUri), 5000);
    img.src = photoUri;
  });
}

/**
 * Native: Use react-native-image-marker to burn watermark
 */
async function burnWatermarkNative(
  photoUri: string,
  watermarkData: WatermarkData,
  Marker: any
): Promise<string> {
  try {
    const watermarkText = [
      watermarkData.timestamp,
      watermarkData.date,
      `📍 ${watermarkData.address}`,
      `🌐 ${watermarkData.latitude.toFixed(6)}, ${watermarkData.longitude.toFixed(6)}`,
      watermarkData.staffName ? `👤 ${watermarkData.staffName}` : "",
      watermarkData.siteName ? `🏢 ${watermarkData.siteName}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const result = await Marker.markText({
      src: photoUri,
      text: watermarkText,
      position: "bottomLeft",
      color: "#FFFFFF",
      fontName: "Arial-BoldMT",
      fontSize: 24,
      scale: 1,
      quality: 90,
      shadowStyle: {
        dx: 2,
        dy: 2,
        radius: 4,
        color: "#000000",
      },
    });

    return result;
  } catch (error) {
    console.log("[BurnWatermark] Native marker error:", error);
    return photoUri;
  }
}
