/**
 * WatermarkService using React Native Skia
 * 
 * Burns watermark text directly onto photos using Skia's off-screen rendering.
 * Works in EAS/APK builds. Falls back gracefully in Expo Go.
 */

import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

export interface WatermarkData {
  timestamp: string;      // e.g., "12:34:56"
  date: string;           // e.g., "01/01/2026"
  address: string;        // e.g., "1 Mill Road, Lincoln, LN1 3JL"
  latitude: number;
  longitude: number;
  staffName?: string;
  siteName?: string;
}

// Lazy load Skia to avoid crashes in Expo Go
let _Skia: any = null;
let _skiaChecked = false;

const getSkia = () => {
  if (_skiaChecked) return _Skia;
  _skiaChecked = true;

  try {
    // Dynamic require to avoid bundler issues
    const SkiaModule = require("@shopify/react-native-skia");
    _Skia = SkiaModule.Skia;
    console.log("[WatermarkSkia] Skia loaded successfully");
  } catch (e: any) {
    console.log("[WatermarkSkia] Skia not available:", e.message);
    _Skia = null;
  }

  return _Skia;
};

/**
 * Check if Skia watermarking is available
 */
export const isSkiaAvailable = (): boolean => {
  if (Platform.OS === "web") return false;
  return getSkia() !== null;
};

/**
 * Process a photo and burn watermark text onto it using Skia.
 */
export const processWatermark = async (
  originalUri: string,
  data: WatermarkData
): Promise<string> => {
  const Skia = getSkia();

  if (!Skia) {
    console.log("[WatermarkSkia] Skia not available, returning original");
    return originalUri;
  }

  try {
    console.log("[WatermarkSkia] Starting watermark...");
    console.log("[WatermarkSkia] Original URI:", originalUri.substring(0, 60));

    // 1. Read the original image as base64
    const base64Data = await FileSystem.readAsStringAsync(originalUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log("[WatermarkSkia] Read base64, length:", base64Data.length);

    // 2. Load into Skia
    const imageData = Skia.Data.fromBase64(base64Data);
    const image = Skia.Image.MakeImageFromEncoded(imageData);

    if (!image) {
      console.error("[WatermarkSkia] Could not decode image");
      return originalUri;
    }

    const width = image.width();
    const height = image.height();
    console.log(`[WatermarkSkia] Image size: ${width}x${height}`);

    // 3. Create an off-screen surface
    const surface = Skia.Surface.MakeOffscreen(width, height);
    if (!surface) {
      console.error("[WatermarkSkia] Could not create surface");
      image.dispose?.();
      return originalUri;
    }

    const canvas = surface.getCanvas();

    // 4. Draw the original photo
    canvas.drawImage(image, 0, 0);

    // 5. Calculate layout based on image size
    const PADDING = Math.round(width * 0.025);
    const FONT_SIZE_LARGE = Math.round(width * 0.045);
    const FONT_SIZE_MEDIUM = Math.round(width * 0.03);
    const FONT_SIZE_SMALL = Math.round(width * 0.025);
    const LINE_HEIGHT = 1.5;

    // 6. Build text lines
    const gpsText = `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`;
    const lines: Array<{ text: string; size: number }> = [
      { text: data.timestamp, size: FONT_SIZE_LARGE },
      { text: data.date, size: FONT_SIZE_MEDIUM },
      { text: `📍 ${data.address}`, size: FONT_SIZE_MEDIUM },
      { text: `🌐 ${gpsText}`, size: FONT_SIZE_SMALL },
    ];

    if (data.siteName) {
      lines.push({ text: `🏢 ${data.siteName}`, size: FONT_SIZE_SMALL });
    }
    if (data.staffName) {
      lines.push({ text: `👤 ${data.staffName}`, size: FONT_SIZE_SMALL });
    }

    // 7. Calculate total height needed
    let totalHeight = PADDING * 2;
    for (const line of lines) {
      totalHeight += line.size * LINE_HEIGHT;
    }

    // 8. Draw semi-transparent background at TOP
    const bgPaint = Skia.Paint();
    bgPaint.setColor(Skia.Color("rgba(0,0,0,0.7)"));

    const bgRect = Skia.XYWHRect(0, 0, width, totalHeight);
    canvas.drawRect(bgRect, bgPaint);

    // 9. Draw text from top
    const textPaint = Skia.Paint();
    textPaint.setColor(Skia.Color("white"));
    textPaint.setAntiAlias(true);

    let yPos = PADDING; // Start from top

    for (const line of lines) {
      const font = Skia.Font(null, line.size);
      yPos += line.size * 0.8;
      canvas.drawText(line.text, PADDING, yPos, textPaint, font);
      yPos += line.size * (LINE_HEIGHT - 0.8);
    }

    // 10. Export result
    console.log("[WatermarkSkia] Exporting...");
    const finalImage = surface.makeImageSnapshot();
    const bytes = finalImage.encodeToBytes(Skia.ImageFormat.JPEG, 85);

    if (!bytes || bytes.length === 0) {
      console.error("[WatermarkSkia] Failed to encode image");
      image.dispose?.();
      surface.dispose?.();
      return originalUri;
    }

    // Convert to base64
    const base64Output = uint8ArrayToBase64(bytes);

    // Save to cache
    const filename = `watermarked_${Date.now()}.jpg`;
    const destPath = `${FileSystem.cacheDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(destPath, base64Output, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Cleanup
    image.dispose?.();
    surface.dispose?.();

    console.log("[WatermarkSkia] Done:", destPath);
    return destPath;

  } catch (e: any) {
    console.error("[WatermarkSkia] Error:", e.message || e);
    return originalUri;
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

  if (typeof btoa !== "undefined") {
    return btoa(binary);
  }

  // Fallback for environments without btoa
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  let i = 0;

  while (i < binary.length) {
    const a = binary.charCodeAt(i++);
    const b = i < binary.length ? binary.charCodeAt(i++) : 0;
    const c = i < binary.length ? binary.charCodeAt(i++) : 0;

    const triplet = (a << 16) | (b << 8) | c;

    result += chars[(triplet >> 18) & 0x3f];
    result += chars[(triplet >> 12) & 0x3f];
    result += i > binary.length + 1 ? "=" : chars[(triplet >> 6) & 0x3f];
    result += i > binary.length ? "=" : chars[triplet & 0x3f];
  }

  return result;
}
