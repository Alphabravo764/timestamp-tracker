import React, { useRef, useImperativeHandle, forwardRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Dimensions, Platform, Image as RNImage } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as FileSystem from "expo-file-system/legacy";

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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Use screen dimensions for capture
const CAPTURE_WIDTH = SCREEN_WIDTH;
const CAPTURE_HEIGHT = SCREEN_WIDTH * 1.33; // 4:3 aspect ratio

/**
 * Component that composites watermark text onto a photo.
 * Renders the photo + overlay, then captures as a single image.
 * 
 * This is a fallback for when Skia is not available (Expo Go).
 */
export const PhotoWatermark = forwardRef<PhotoWatermarkRef, {}>((_, ref) => {
  const containerRef = useRef<View>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [watermarkData, setWatermarkData] = useState<WatermarkData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const resolveRef = useRef<((uri: string) => void) | null>(null);

  const handleImageLoad = useCallback(async () => {
    if (!containerRef.current || !resolveRef.current || !photoUri) {
      return;
    }

    try {
      // Wait for render to complete
      await new Promise(r => setTimeout(r, 100));
      
      console.log("[PhotoWatermark] Capturing composite...");
      
      const capturedUri = await captureRef(containerRef.current, {
        format: "jpg",
        quality: 0.85,
        result: "tmpfile",
      });
      
      console.log("[PhotoWatermark] Captured:", capturedUri?.substring(0, 60));
      
      if (capturedUri && resolveRef.current) {
        resolveRef.current(capturedUri);
      }
    } catch (error) {
      console.error("[PhotoWatermark] Capture error:", error);
      if (resolveRef.current && photoUri) {
        resolveRef.current(photoUri);
      }
    } finally {
      cleanup();
    }
  }, [photoUri]);

  const cleanup = () => {
    setPhotoUri(null);
    setWatermarkData(null);
    setIsProcessing(false);
    resolveRef.current = null;
  };

  useImperativeHandle(ref, () => ({
    addWatermark: async (uri: string, data: WatermarkData): Promise<string> => {
      console.log("[PhotoWatermark] Starting watermark...");
      
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        setIsProcessing(true);
        setWatermarkData(data);
        setPhotoUri(uri);
        
        // Timeout fallback
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
        {/* Use React Native's Image for better compatibility */}
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
        
        {/* Watermark strip at bottom */}
        <View style={styles.watermarkStrip}>
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
          <Text style={styles.addressText} numberOfLines={1}>
            📍 {watermarkData.address}
          </Text>
          <Text style={styles.coordsText}>🌐 {coords}</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  hiddenContainer: {
    position: "absolute",
    // Position below the visible screen area
    top: SCREEN_HEIGHT + 100,
    left: 0,
    width: CAPTURE_WIDTH,
    height: CAPTURE_HEIGHT,
    opacity: 1, // Must be visible for capture to work
    zIndex: -1000,
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
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  leftCol: {
    flex: 1,
  },
  rightCol: {
    alignItems: "flex-end",
  },
  timeText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  dateText: {
    color: "#E0E0E0",
    fontSize: 13,
    marginTop: 2,
  },
  metaText: {
    color: "#CCCCCC",
    fontSize: 12,
    marginBottom: 2,
  },
  addressText: {
    color: "#FFFFFF",
    fontSize: 13,
    marginTop: 4,
  },
  coordsText: {
    color: "#AAAAAA",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 4,
  },
});
