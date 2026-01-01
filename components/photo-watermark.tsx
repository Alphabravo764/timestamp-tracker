import React, { useRef, useImperativeHandle, forwardRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Dimensions, Platform } from "react-native";
import { Image } from "expo-image";
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

// Use a fixed size that works well for photos
const CAPTURE_WIDTH = Math.min(SCREEN_WIDTH, 400);
const CAPTURE_HEIGHT = CAPTURE_WIDTH * 1.33; // 4:3 aspect ratio

/**
 * Component that composites watermark text onto a photo.
 * Uses captureRef to capture the rendered Image + Text overlay.
 */
export const PhotoWatermark = forwardRef<PhotoWatermarkRef, {}>((_, ref) => {
  const containerRef = useRef<View>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [watermarkData, setWatermarkData] = useState<WatermarkData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const resolveRef = useRef<((uri: string) => void) | null>(null);
  const rejectRef = useRef<((error: Error) => void) | null>(null);

  const handleImageLoad = useCallback(async () => {
    if (!containerRef.current || !resolveRef.current || !photoUri) {
      return;
    }

    try {
      // Wait a frame for the render to complete
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 50)));
      
      console.log("[PhotoWatermark] Capturing...");
      const capturedUri = await captureRef(containerRef.current, {
        format: "jpg",
        quality: 0.85,
        result: "tmpfile",
      });
      
      console.log("[PhotoWatermark] Captured:", capturedUri?.substring(0, 60));
      resolveRef.current(capturedUri);
    } catch (error) {
      console.error("[PhotoWatermark] Capture failed:", error);
      // Return original photo on error
      resolveRef.current(photoUri);
    } finally {
      // Clean up
      setPhotoUri(null);
      setWatermarkData(null);
      setIsProcessing(false);
      resolveRef.current = null;
      rejectRef.current = null;
    }
  }, [photoUri]);

  useImperativeHandle(ref, () => ({
    addWatermark: async (uri: string, data: WatermarkData): Promise<string> => {
      console.log("[PhotoWatermark] Starting watermark for:", uri.substring(0, 50));
      
      return new Promise((resolve, reject) => {
        resolveRef.current = resolve;
        rejectRef.current = reject;
        setIsProcessing(true);
        setWatermarkData(data);
        setPhotoUri(uri);
        
        // Timeout fallback - if capture doesn't happen in 3 seconds, return original
        setTimeout(() => {
          if (resolveRef.current) {
            console.log("[PhotoWatermark] Timeout - returning original");
            resolveRef.current(uri);
            setPhotoUri(null);
            setWatermarkData(null);
            setIsProcessing(false);
            resolveRef.current = null;
          }
        }, 3000);
      });
    },
  }));

  // Don't render anything if not processing
  if (!photoUri || !watermarkData || !isProcessing) {
    return null;
  }

  const coords = `${watermarkData.latitude.toFixed(6)}, ${watermarkData.longitude.toFixed(6)}`;

  return (
    <View style={styles.offscreenContainer} pointerEvents="none">
      <View 
        ref={containerRef} 
        style={styles.captureContainer}
        collapsable={false}
      >
        <Image
          source={{ uri: photoUri }}
          style={styles.image}
          contentFit="cover"
          onLoad={handleImageLoad}
          onError={(e) => {
            console.error("[PhotoWatermark] Image load error");
            if (resolveRef.current) {
              resolveRef.current(photoUri);
            }
          }}
        />
        {/* Watermark overlay at bottom */}
        <View style={styles.watermarkStrip}>
          <View style={styles.watermarkRow}>
            <View style={styles.leftColumn}>
              <Text style={styles.timeText}>{watermarkData.timestamp}</Text>
              <Text style={styles.dateText}>{watermarkData.date}</Text>
            </View>
            <View style={styles.rightColumn}>
              {watermarkData.siteName && (
                <Text style={styles.siteText}>🏢 {watermarkData.siteName}</Text>
              )}
              {watermarkData.staffName && (
                <Text style={styles.staffText}>👤 {watermarkData.staffName}</Text>
              )}
            </View>
          </View>
          <Text style={styles.addressText} numberOfLines={1}>📍 {watermarkData.address}</Text>
          <Text style={styles.coordsText}>🌐 {coords}</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  offscreenContainer: {
    position: "absolute",
    // Position off-screen but still rendered
    top: -CAPTURE_HEIGHT - 100,
    left: 0,
    width: CAPTURE_WIDTH,
    height: CAPTURE_HEIGHT,
    overflow: "hidden",
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
  watermarkStrip: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  watermarkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  leftColumn: {
    flex: 1,
  },
  rightColumn: {
    alignItems: "flex-end",
  },
  timeText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  dateText: {
    color: "#DDDDDD",
    fontSize: 12,
  },
  siteText: {
    color: "#CCCCCC",
    fontSize: 11,
  },
  staffText: {
    color: "#CCCCCC",
    fontSize: 11,
  },
  addressText: {
    color: "#FFFFFF",
    fontSize: 12,
    marginTop: 4,
  },
  coordsText: {
    color: "#AAAAAA",
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
});
