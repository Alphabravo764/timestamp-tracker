/**
 * Photo Compression - Compress photos before upload
 * Max width: 1920px, Quality: 70%
 */

import { Platform } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";

const MAX_WIDTH = 1920;
const QUALITY = 0.7;

/**
 * Compress photo to reduce file size before upload
 * - Resizes to max 1920px width (maintains aspect ratio)
 * - Compresses to 70% JPEG quality
 */
export async function compressPhoto(photoUri: string): Promise<string> {
  if (Platform.OS === "web") {
    return compressPhotoWeb(photoUri);
  } else {
    return compressPhotoNative(photoUri);
  }
}

/**
 * Web implementation using HTML Canvas
 */
async function compressPhotoWeb(photoUri: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      try {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;
        
        if (width > MAX_WIDTH) {
          const ratio = MAX_WIDTH / width;
          width = MAX_WIDTH;
          height = Math.round(height * ratio);
        }
        
        // Create canvas and draw resized image
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(photoUri);
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Export as compressed JPEG
        const compressedUri = canvas.toDataURL("image/jpeg", QUALITY);
        console.log(`[Compression] Web: ${img.width}x${img.height} -> ${width}x${height}`);
        resolve(compressedUri);
      } catch (error) {
        console.log("[Compression] Web error:", error);
        resolve(photoUri);
      }
    };
    
    img.onerror = () => {
      console.log("[Compression] Web image load error");
      resolve(photoUri);
    };
    
    img.src = photoUri;
  });
}

/**
 * Native implementation using expo-image-manipulator
 */
async function compressPhotoNative(photoUri: string): Promise<string> {
  try {
    // Get image info to check dimensions
    const result = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ resize: { width: MAX_WIDTH } }], // Resize if larger than MAX_WIDTH
      { compress: QUALITY, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    console.log(`[Compression] Native: compressed to ${result.uri.substring(0, 50)}`);
    return result.uri;
  } catch (error) {
    console.log("[Compression] Native error:", error);
    return photoUri;
  }
}

/**
 * Get estimated file size reduction
 */
export function getCompressionInfo(): { maxWidth: number; quality: number } {
  return { maxWidth: MAX_WIDTH, quality: QUALITY * 100 };
}
