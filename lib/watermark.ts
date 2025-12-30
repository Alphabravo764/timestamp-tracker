import * as ImageManipulator from "expo-image-manipulator";
import { Platform } from "react-native";

export interface WatermarkOptions {
  timestamp: string;
  address: string;
  latitude: number;
  longitude: number;
}

// Create a simple watermark by drawing text on canvas (web) or using image manipulator
export const addWatermarkToPhoto = async (
  photoUri: string,
  options: WatermarkOptions
): Promise<string> => {
  try {
    // For now, we'll just return the original photo
    // The timestamp info is stored in metadata
    // Full watermark implementation would require native module or canvas
    
    if (Platform.OS === "web") {
      // On web, we can use canvas to add watermark
      return await addWatermarkCanvas(photoUri, options);
    }
    
    // On native, expo-image-manipulator doesn't support text overlay
    // We'd need a native module or expo-canvas
    // For now, return original with metadata stored separately
    return photoUri;
  } catch (error) {
    console.error("Watermark error:", error);
    return photoUri;
  }
};

// Web-only canvas watermark
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
        
        // Add semi-transparent background for text
        const boxHeight = 120;
        const gradient = ctx.createLinearGradient(0, canvas.height - boxHeight, 0, canvas.height);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(0.3, "rgba(0,0,0,0.7)");
        gradient.addColorStop(1, "rgba(0,0,0,0.9)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, canvas.height - boxHeight, canvas.width, boxHeight);
        
        // Text settings
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "left";
        const padding = 20;
        let y = canvas.height - boxHeight + 30;
        
        // Timestamp (large)
        const fontSize = Math.max(24, Math.floor(canvas.width / 30));
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        ctx.fillText(options.timestamp, padding, y);
        y += fontSize + 8;
        
        // Address
        const smallFont = Math.max(16, Math.floor(canvas.width / 45));
        ctx.font = `${smallFont}px Arial, sans-serif`;
        ctx.fillStyle = "#DDDDDD";
        
        // Truncate address if too long
        const maxWidth = canvas.width - padding * 2;
        let address = options.address;
        while (ctx.measureText(address).width > maxWidth && address.length > 10) {
          address = address.slice(0, -4) + "...";
        }
        ctx.fillText(address, padding, y);
        y += smallFont + 6;
        
        // Coordinates
        ctx.font = `${smallFont - 2}px Arial, sans-serif`;
        ctx.fillStyle = "#AAAAAA";
        const coords = `${options.latitude.toFixed(6)}, ${options.longitude.toFixed(6)}`;
        ctx.fillText(coords, padding, y);
        
        // Convert to data URL
        const watermarkedUri = canvas.toDataURL("image/jpeg", 0.9);
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

// Format timestamp for watermark
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
  return date.toLocaleString("en-US", options);
};
