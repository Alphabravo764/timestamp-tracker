import React, { useRef, useImperativeHandle, forwardRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Dimensions, Platform, Image as RNImage } from "react-native";
import { captureRef } from "react-native-view-shot";

export interface WatermarkData {
  timestamp: string;
  date: string;
  address: string;
  latitude: number;
  longitude: number;
  staffName?: string;
  siteName?: string;
}

export interface PhotoWatermarkRef {
  addWatermark: (photoUri: string, data: WatermarkData) => Promise<string>;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Use screen width for capture, 4:3 aspect ratio
const CAPTURE_WIDTH = SCREEN_WIDTH;
const CAPTURE_HEIGHT = SCREEN_WIDTH * 1.33;

/**
 * PhotoWatermark - Composites timestamp footer onto photos
 * 
 * This is the CORRECT approach used by professional timestamp camera apps:
 * 1. Render photo as <Image />
 * 2. Overlay footer strip with timestamp info
 * 3. Capture composite using captureRef
 * 4. Return watermarked image URI
 * 
 * IMPORTANT: Component uses opacity:0 (NOT top:-9999) so it's
 * rendered and measured by GPU but invisible to user.
 */
export const PhotoWatermark = forwardRef<PhotoWatermarkRef, {}>((_, ref) => {
  const containerRef = useRef<View>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [watermarkData, setWatermarkData] = useState<WatermarkData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const resolveRef = useRef<((uri: string) => void) | null>(null);

  const cleanup = useCallback(() => {
    setPhotoUri(null);
    setWatermarkData(null);
    setIsProcessing(false);
    resolveRef.current = null;
  }, []);

  const handleImageLoad = useCallback(async () => {
    if (!containerRef.current || !resolveRef.current || !photoUri) {
      return;
    }

    try {
      // Wait for render to complete (important for GPU to paint)
      await new Promise(r => setTimeout(r, 150));
      
      console.log("[PhotoWatermark] Capturing composite...");
      
      const capturedUri = await captureRef(containerRef.current, {
        format: "jpg",
        quality: 0.9,
        result: "tmpfile",
      });
      
      console.log("[PhotoWatermark] Captured:", capturedUri?.substring(0, 60));
      
      if (capturedUri && resolveRef.current) {
        resolveRef.current(capturedUri);
      }
    } catch (error) {
      console.error("[PhotoWatermark] Capture error:", error);
      // Return original on error
      if (resolveRef.current && photoUri) {
        resolveRef.current(photoUri);
      }
    } finally {
      cleanup();
    }
  }, [photoUri, cleanup]);

  useImperativeHandle(ref, () => ({
    addWatermark: async (uri: string, data: WatermarkData): Promise<string> => {
      console.log("[PhotoWatermark] Starting watermark for:", uri.substring(0, 50));
      
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        setIsProcessing(true);
        setWatermarkData(data);
        setPhotoUri(uri);
        
        // Timeout fallback - return original if capture takes too long
        setTimeout(() => {
          if (resolveRef.current) {
            console.log("[PhotoWatermark] Timeout - returning original");
            resolveRef.current(uri);
            cleanup();
          }
        }, 5000);
      });
    },
  }));

  // Don't render if not processing
  if (!photoUri || !watermarkData || !isProcessing) {
    return null;
  }

  const coords = `${watermarkData.latitude.toFixed(6)}, ${watermarkData.longitude.toFixed(6)}`;

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <View 
        ref={containerRef} 
        style={styles.captureContainer}
        collapsable={false}
      >
        {/* Photo */}
        <RNImage
          source={{ uri: photoUri }}
          style={styles.image}
          resizeMode="cover"
          onLoad={handleImageLoad}
          onError={() => {
            console.error("[PhotoWatermark] Image load error");
            if (resolveRef.current) {
              resolveRef.current(photoUri);
              cleanup();
            }
          }}
        />
        
        {/* Footer watermark strip */}
        <View style={styles.watermarkFooter}>
          <View style={styles.topRow}>
            <View style={styles.leftCol}>
              <Text style={styles.timeText}>{watermarkData.timestamp}</Text>
              <Text style={styles.dateText}>{watermarkData.date}</Text>
            </View>
            <View style={styles.rightCol}>
              {watermarkData.siteName && (
                <Text style={styles.metaText}>🏢 {watermarkData.siteName}</Text>
              )}
              {watermarkData.staffName && (
                <Text style={styles.metaText}>👤 {watermarkData.staffName}</Text>
              )}
            </View>
          </View>
          <Text style={styles.addressText} numberOfLines={2}>
            📍 {watermarkData.address}
          </Text>
          <Text style={styles.coordsText}>🌐 {coords}</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  // CORRECT: Use opacity:0 so component is rendered/measured but invisible
  // DO NOT use top:-9999 as that prevents GPU painting
  hiddenContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -20,
    opacity: 0,
    width: CAPTURE_WIDTH,
    height: CAPTURE_HEIGHT,
  },
  captureContainer: {
    width: CAPTURE_WIDTH,
    height: CAPTURE_HEIGHT,
    backgroundColor: "#000",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  watermarkFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  leftCol: {
    flex: 1,
  },
  rightCol: {
    alignItems: "flex-end",
  },
  timeText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  dateText: {
    color: "#E0E0E0",
    fontSize: 14,
    marginTop: 2,
  },
  metaText: {
    color: "#CCCCCC",
    fontSize: 13,
    marginBottom: 3,
  },
  addressText: {
    color: "#FFFFFF",
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  coordsText: {
    color: "#AAAAAA",
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 6,
  },
});
