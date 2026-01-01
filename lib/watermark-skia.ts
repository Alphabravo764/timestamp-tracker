/**
 * WatermarkService using React Native Skia
 * 
 * This service burns watermark text directly onto photos using Skia's off-screen rendering.
 * Unlike ViewShot, this works reliably because it operates on the image bytes directly,
 * not on rendered React Native views.
 * 
 * IMPORTANT: Requires EAS dev client build (not Expo Go) to work on device.
 * In Expo Go, this will fall back to returning the original image.
 */

import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

// Skia imports - these will only work in EAS dev client builds
let Skia: any = null;
let SkiaLoaded = false;

// Try to load Skia (will fail in Expo Go)
try {
  const SkiaModule = require("@shopify/react-native-skia");
  Skia = SkiaModule.Skia;
  SkiaLoaded = true;
  console.log("[WatermarkSkia] Skia loaded successfully");
} catch (e) {
  console.log("[WatermarkSkia] Skia not available (expected in Expo Go)");
}

export interface WatermarkData {
  timestamp: string;      // e.g., "12:34:56"
  date: string;           // e.g., "01/01/2026"
  address: string;        // e.g., "1 Mill Road, Lincoln, LN1 3JL"
  latitude: number;
  longitude: number;
  staffName?: string;
  siteName?: string;
}

/**
 * Process a photo and burn watermark text onto it using Skia.
 * 
 * @param originalUri - The file:// URI of the original photo
 * @param data - The watermark data to burn onto the photo
 * @returns The URI of the watermarked photo, or the original URI if watermarking fails
 */
export const processWatermark = async (
  originalUri: string,
  data: WatermarkData
): Promise<string> => {
  // If Skia isn't loaded (Expo Go), return original
  if (!SkiaLoaded || !Skia) {
    console.log("[WatermarkSkia] Skia not available, returning original image");
    return originalUri;
  }

  try {
    console.log("[WatermarkSkia] Starting watermark process...");
    
    // 1. Read the original image as base64
    const base64Data = await FileSystem.readAsStringAsync(originalUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // 2. Load into Skia
    const imageData = Skia.Data.fromBase64(base64Data);
    const image = Skia.Image.MakeImageFromEncoded(imageData);
    
    if (!image) {
      throw new Error("Could not decode image");
    }

    const width = image.width();
    const height = image.height();
    console.log(`[WatermarkSkia] Image size: ${width}x${height}`);

    // 3. Create an off-screen surface
    const surface = Skia.Surface.MakeOffscreen(width, height);
    if (!surface) {
      throw new Error("Could not create Skia surface");
    }

    const canvas = surface.getCanvas();

    // 4. Draw the original photo
    canvas.drawImage(image, 0, 0);

    // 5. Calculate layout constants based on image size
    const PADDING = Math.round(width * 0.03);
    const FONT_SIZE_HEADER = Math.round(width * 0.04);
    const FONT_SIZE_BODY = Math.round(width * 0.025);
    const LINE_HEIGHT = 1.4;
    
    // 6. Prepare text content
    const gpsText = `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`;
    const lines = [
      { text: data.timestamp, size: FONT_SIZE_HEADER, bold: true },
      { text: data.date, size: FONT_SIZE_BODY, bold: false },
      { text: `📍 ${data.address}`, size: FONT_SIZE_BODY, bold: false },
      { text: `🌐 ${gpsText}`, size: FONT_SIZE_BODY, bold: false },
    ];
    
    if (data.siteName) {
      lines.push({ text: `🏢 ${data.siteName}`, size: FONT_SIZE_BODY, bold: false });
    }
    if (data.staffName) {
      lines.push({ text: `👤 ${data.staffName}`, size: FONT_SIZE_BODY, bold: false });
    }

    // 7. Calculate total text height
    let totalTextHeight = 0;
    for (const line of lines) {
      totalTextHeight += line.size * LINE_HEIGHT;
    }
    totalTextHeight += PADDING * 2;

    // 8. Draw semi-transparent background strip at bottom
    const bgPaint = Skia.Paint();
    bgPaint.setColor(Skia.Color("rgba(0,0,0,0.65)"));
    
    canvas.drawRect(
      Skia.XYWHRect(0, height - totalTextHeight, width, totalTextHeight),
      bgPaint
    );

    // 9. Draw text lines
    const textPaint = Skia.Paint();
    textPaint.setColor(Skia.Color("white"));
    textPaint.setAntiAlias(true);

    let yOffset = height - totalTextHeight + PADDING;
    
    for (const line of lines) {
      // Create font for this line
      const font = Skia.Font(null, line.size);
      
      // Draw text
      canvas.drawText(line.text, PADDING, yOffset + line.size * 0.8, textPaint, font);
      
      yOffset += line.size * LINE_HEIGHT;
    }

    // 10. Export the result
    const finalImage = surface.makeImageSnapshot();
    const bytes = finalImage.encodeToBytes(Skia.ImageFormat.JPEG, 85);
    
    // Convert Uint8Array to Base64
    const base64Output = uint8ArrayToBase64(bytes);
    
    // Save to file
    const filename = `watermarked_${Date.now()}.jpg`;
    const destPath = `${FileSystem.cacheDirectory}${filename}`;
    
    await FileSystem.writeAsStringAsync(destPath, base64Output, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Cleanup
    image.dispose?.();
    surface.dispose?.();

    console.log("[WatermarkSkia] Watermark complete:", destPath);
    return destPath;

  } catch (e: any) {
    console.error("[WatermarkSkia] Error:", e.message || e);
    return originalUri; // Fallback to original
  }
};

/**
 * Convert Uint8Array to Base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // Use btoa if available (web), otherwise use Buffer (Node)
  if (typeof btoa !== "undefined") {
    return btoa(binary);
  }
  return Buffer.from(binary, "binary").toString("base64");
}

/**
 * Check if Skia watermarking is available
 */
export const isSkiaAvailable = (): boolean => {
  return SkiaLoaded && Skia !== null;
};
