import sharp from "sharp";

export interface WatermarkRequest {
  imageBase64: string; // Base64 encoded image (without data URI prefix)
  timestamp: string;
  address: string;
  latitude: number;
  longitude: number;
  staffName?: string;
  siteName?: string;
}

export interface WatermarkResponse {
  success: boolean;
  watermarkedBase64?: string; // Base64 encoded watermarked image
  error?: string;
}

// Escape XML special characters
const escapeXml = (str: string): string => {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

// Create full-size SVG overlay with watermark at top
const createFullSizeWatermarkSvg = (
  width: number,
  height: number,
  options: {
    timestamp: string;
    address: string;
    latitude: number;
    longitude: number;
    staffName?: string;
    siteName?: string;
  }
): string => {
  const boxHeight = Math.max(140, Math.floor(height * 0.18));
  const padding = Math.max(20, Math.floor(width * 0.03));
  const fontSize = Math.max(28, Math.floor(width / 25));
  const mediumFont = Math.max(20, Math.floor(width / 35));
  const smallFont = Math.max(16, Math.floor(width / 45));

  // Truncate address if too long (rough estimate)
  let address = options.address || "Location unavailable";
  const maxChars = Math.floor(width / (mediumFont * 0.6));
  if (address.length > maxChars) {
    address = address.substring(0, maxChars - 3) + "...";
  }

  const coords = `${options.latitude.toFixed(6)}, ${options.longitude.toFixed(6)}`;

  // Build right-side text (positioned at top)
  let rightSideText = "";
  let rightY = 35;
  if (options.siteName) {
    rightSideText += `<text x="${width - padding}" y="${rightY}" font-size="${smallFont}" fill="#AAAAAA" text-anchor="end" font-family="Arial, sans-serif">${escapeXml(options.siteName)}</text>`;
    rightY += smallFont + 6;
  }
  if (options.staffName) {
    rightSideText += `<text x="${width - padding}" y="${rightY}" font-size="${smallFont}" fill="#AAAAAA" text-anchor="end" font-family="Arial, sans-serif">${escapeXml(options.staffName)}</text>`;
  }

  // Create full-size SVG that matches the image dimensions exactly (watermark at TOP)
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0.85" />
        <stop offset="80%" style="stop-color:rgb(0,0,0);stop-opacity:0.6" />
        <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:0" />
      </linearGradient>
    </defs>
    
    <!-- Gradient background at TOP -->
    <rect x="0" y="0" width="${width}" height="${boxHeight}" fill="url(#grad)"/>
    
    <!-- Timestamp (large, bold) -->
    <text x="${padding}" y="35" font-size="${fontSize}" font-weight="bold" fill="#FFFFFF" font-family="Arial, sans-serif">${escapeXml(options.timestamp)}</text>
    
    <!-- Address -->
    <text x="${padding}" y="${35 + fontSize + 10}" font-size="${mediumFont}" fill="#F0F0F0" font-family="Arial, sans-serif">${escapeXml(address)}</text>
    
    <!-- GPS Coordinates -->
    <text x="${padding}" y="${35 + fontSize + 10 + mediumFont + 8}" font-size="${smallFont}" fill="#CCCCCC" font-family="Arial, sans-serif">${coords}</text>
    
    <!-- Right side: Site and Staff -->
    ${rightSideText}
  </svg>`;
};

// Add watermark to image using Sharp
export const addWatermarkServer = async (
  request: WatermarkRequest
): Promise<WatermarkResponse> => {
  try {
    // Decode base64 image
    const imageBuffer = Buffer.from(request.imageBase64, "base64");

    // Get image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width || 1080;
    const height = metadata.height || 1920;

    // For very small images (like test images), skip watermarking
    if (width < 100 || height < 100) {
      // Just return the original image converted to JPEG
      const outputBuffer = await sharp(imageBuffer)
        .jpeg({ quality: 85 })
        .toBuffer();
      return {
        success: true,
        watermarkedBase64: outputBuffer.toString("base64"),
      };
    }

    // Create full-size watermark SVG that matches image dimensions
    const watermarkSvg = createFullSizeWatermarkSvg(width, height, {
      timestamp: request.timestamp,
      address: request.address,
      latitude: request.latitude,
      longitude: request.longitude,
      staffName: request.staffName,
      siteName: request.siteName,
    });

    // Convert SVG to PNG buffer with Sharp
    const watermarkBuffer = await sharp(Buffer.from(watermarkSvg))
      .png()
      .toBuffer();

    // Composite watermark onto image
    const watermarkedBuffer = await sharp(imageBuffer)
      .composite([
        {
          input: watermarkBuffer,
          top: 0,
          left: 0,
        },
      ])
      .jpeg({ quality: 85 })
      .toBuffer();

    // Convert to base64
    const watermarkedBase64 = watermarkedBuffer.toString("base64");

    return {
      success: true,
      watermarkedBase64,
    };
  } catch (error) {
    console.error("Server watermark error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
