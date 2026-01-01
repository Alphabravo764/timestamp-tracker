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
 * PhotoWatermark - UK Security Industry Standard
 * 
 * Professional timestamp footer for security patrol evidence photos.
 * Matches industry standards used by UK security companies.
 * 
 * Footer includes:
 * - Large timestamp (HH:MM:SS) - primary evidence
 * - Date (DD/MM/YYYY) - UK format
 * - Full address with postcode
 * - GPS coordinates (6 decimal places)
 * - Site name and officer name
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
      // Wait for render to complete
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
      if (resolveRef.current && photoUri) {
        resolveRef.current(photoUri);
      }
    } finally {
      cleanup();
    }
  }, [photoUri, cleanup]);

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
        
        {/* UK Security Industry Standard Footer */}
        <View style={styles.footer}>
          {/* Row 1: Time and Site/Staff */}
          <View style={styles.row}>
            <View style={styles.timeSection}>
              <Text style={styles.timeText}>{watermarkData.timestamp}</Text>
              <Text style={styles.dateText}>{watermarkData.date}</Text>
            </View>
            <View style={styles.infoSection}>
              {watermarkData.siteName && (
                <Text style={styles.siteText}>{watermarkData.siteName}</Text>
              )}
              {watermarkData.staffName && (
                <Text style={styles.staffText}>Officer: {watermarkData.staffName}</Text>
              )}
            </View>
          </View>
          
          {/* Row 2: Address */}
          <Text style={styles.addressText} numberOfLines={2}>
            {watermarkData.address}
          </Text>
          
          {/* Row 3: GPS Coordinates */}
          <Text style={styles.coordsText}>
            GPS: {coords}
          </Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  // Use opacity:0 so component is rendered but invisible
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
  // UK Security Industry Standard Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: 2,
    borderTopColor: "#FF6600", // Orange accent - common in security apps
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  timeSection: {
    flex: 1,
  },
  infoSection: {
    alignItems: "flex-end",
    maxWidth: "45%",
  },
  // Large, bold timestamp - primary evidence
  timeText: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    letterSpacing: 1,
  },
  // UK date format
  dateText: {
    color: "#CCCCCC",
    fontSize: 14,
    marginTop: 2,
  },
  // Site name - prominent
  siteText: {
    color: "#FF6600",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "right",
  },
  // Officer name
  staffText: {
    color: "#AAAAAA",
    fontSize: 12,
    marginTop: 2,
    textAlign: "right",
  },
  // Full address with postcode
  addressText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  // GPS coordinates - monospace for accuracy
  coordsText: {
    color: "#888888",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
