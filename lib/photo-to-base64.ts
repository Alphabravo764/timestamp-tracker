import { Platform } from "react-native";

// Conditional imports - only load expo modules on mobile
let FileSystem: any;
let ImageManipulator: any;

if (Platform.OS !== 'web') {
  try {
    FileSystem = require("expo-file-system/legacy");
    ImageManipulator = require("expo-image-manipulator");
  } catch (e) {
    // Server environment - expo modules not available
    console.log('[photo-to-base64] Running on server, expo modules not loaded');
  }
}

/**
 * Convert a photo URI to a base64 data URI for embedding in PDF HTML.
 * Resizes the image to reduce PDF size and improve rendering performance.
 * 
 * @param photoUri - The original photo URI (file:// or content://)
 * @param maxWidth - Maximum width to resize to (default 900px)
 * @param quality - JPEG compression quality 0-1 (default 0.75)
 * @returns Base64 data URI string or null if conversion fails
 */
export async function photoToBase64DataUri(
  photoUri: string,
  maxWidth: number = 900,
  quality: number = 0.75
): Promise<string | null> {
  try {
    // If already a data URI, return as-is
    if (photoUri.startsWith("data:")) {
      return photoUri;
    }

    // On web, we can use the URI directly if it's a blob or http URL
    if (Platform.OS === "web") {
      if (photoUri.startsWith("blob:") || photoUri.startsWith("http")) {
        // For web, try to fetch and convert to base64
        try {
          const response = await fetch(photoUri);
          const blob = await response.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } catch {
          return photoUri; // Return original if fetch fails
        }
      }
      return photoUri;
    }

    // On native (iOS/Android), use ImageManipulator to resize and convert
    if (!ImageManipulator || !FileSystem) {
      // Server environment - return original URI
      console.log('[photo-to-base64] Expo modules not available, returning original URI');
      return photoUri;
    }
    
    // 1) Resize to keep PDF light + fast
    const resized = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ resize: { width: maxWidth } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );

    // 2) Convert to base64
    const base64 = await FileSystem.readAsStringAsync(resized.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // 3) Return as data URI
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error("[photoToBase64DataUri] Error converting photo:", error);
    return null;
  }
}

/**
 * Convert multiple photos to base64 data URIs.
 * Limits to maxPhotos to prevent WebView memory issues.
 * 
 * @param photoUris - Array of photo URIs
 * @param maxPhotos - Maximum number of photos to convert (default 12)
 * @returns Array of base64 data URIs (null entries for failed conversions)
 */
export async function photosToBase64DataUris(
  photoUris: string[],
  maxPhotos: number = 12
): Promise<(string | null)[]> {
  // Limit photos to prevent WebView memory issues
  const limitedUris = photoUris.slice(0, maxPhotos);
  
  // Convert all photos in parallel for speed
  const results = await Promise.all(
    limitedUris.map(uri => photoToBase64DataUri(uri))
  );
  
  return results;
}
