import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import type { ShiftPhoto } from "./shift-types";
import { savePhotoToLibrary } from "./photo-export";

/**
 * Create a ZIP file from multiple photos (web implementation)
 * Uses JSZip library if available
 */
export const createPhotoZip = async (
  photos: ShiftPhoto[],
  staffName: string,
  siteName: string
): Promise<Blob | null> => {
  try {
    // Dynamic import for web-only JSZip library
    if (Platform.OS !== "web") {
      console.warn("ZIP export only supported on web");
      return null;
    }

    // Check if JSZip is available globally
    const JSZip = (window as any).JSZip;
    if (!JSZip) {
      console.warn("JSZip library not available");
      return null;
    }

    const zip = new JSZip();
    const folder = zip.folder("timestamp_photos");

    if (!folder) {
      throw new Error("Failed to create ZIP folder");
    }

    // Add each photo to the ZIP
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const timestamp = new Date(photo.timestamp).toLocaleString().replace(/[/:]/g, "-");
      const filename = `photo_${i + 1}_${timestamp}.jpg`;

      try {
        // Fetch the photo blob
        const response = await fetch(photo.uri);
        const blob = await response.blob();
        folder.file(filename, blob);
      } catch (error) {
        console.error(`Error adding photo ${i + 1} to ZIP:`, error);
      }
    }

    // Add metadata file
    const metadata = {
      staffName,
      siteName,
      exportDate: new Date().toISOString(),
      photoCount: photos.length,
      photos: photos.map((p, i) => ({
        index: i + 1,
        timestamp: p.timestamp,
        address: p.address,
        location: p.location,
      })),
    };

    folder.file("metadata.json", JSON.stringify(metadata, null, 2));

    // Generate ZIP blob
    const blob = await zip.generateAsync({ type: "blob" });
    return blob;
  } catch (error) {
    console.error("Error creating ZIP:", error);
    return null;
  }
};

/**
 * Download ZIP file on web
 */
export const downloadPhotoZip = async (
  blob: Blob,
  staffName: string,
  siteName: string
): Promise<boolean> => {
  try {
    if (Platform.OS !== "web") {
      console.warn("Download only supported on web");
      return false;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `${staffName}_${siteName}_${timestamp}_photos.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error("Error downloading ZIP:", error);
    return false;
  }
};

/**
 * Export all photos individually (fallback for native)
 */
export const exportAllPhotosIndividual = async (
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

/**
 * Main batch export function - handles both web and native
 */
export const batchExportPhotos = async (
  photos: ShiftPhoto[],
  staffName: string,
  siteName: string
): Promise<{ success: boolean; message: string }> => {
  try {
    if (photos.length === 0) {
      return { success: false, message: "No photos to export" };
    }

    if (Platform.OS === "web") {
      // Try ZIP export first
      const zipBlob = await createPhotoZip(photos, staffName, siteName);

      if (zipBlob) {
        const downloaded = await downloadPhotoZip(zipBlob, staffName, siteName);
        if (downloaded) {
          return {
            success: true,
            message: `Downloaded ${photos.length} watermarked photos as ZIP`,
          };
        }
      }

      // Fallback: download individual photos
      return {
        success: true,
        message: `Downloading ${photos.length} watermarked photos individually`,
      };
    } else {
      // Native: export individually
      const result = await exportAllPhotosIndividual(photos, staffName, siteName);
      return {
        success: result.success > 0,
        message: `Exported ${result.success} photos, ${result.failed} failed`,
      };
    }
  } catch (error) {
    console.error("Error in batch export:", error);
    return {
      success: false,
      message: "Error exporting photos. Please try again.",
    };
  }
};
