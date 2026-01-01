import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect } from "react";
import { View, Text, Image, StyleSheet, Dimensions, Platform } from "react-native";
import ViewShot from "react-native-view-shot";

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

/**
 * Hidden component that composites watermark text onto a photo.
 * 
 * Usage:
 * 1. Render this component (it's invisible)
 * 2. Call ref.addWatermark(photoUri, watermarkData) 
 * 3. Returns a new URI with the watermark burned in
 */
export const PhotoWatermark = forwardRef<PhotoWatermarkRef, {}>((_, ref) => {
  const viewShotRef = useRef<ViewShot>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [watermarkData, setWatermarkData] = useState<WatermarkData | null>(null);
  const [resolveCapture, setResolveCapture] = useState<((uri: string) => void) | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useImperativeHandle(ref, () => ({
    addWatermark: async (uri: string, data: WatermarkData): Promise<string> => {
      return new Promise((resolve, reject) => {
        setPhotoUri(uri);
        setWatermarkData(data);
        setImageLoaded(false);
        setResolveCapture(() => resolve);
        
        // Timeout fallback
        setTimeout(() => {
          if (!imageLoaded) {
            console.log("[PhotoWatermark] Timeout - returning original");
            resolve(uri);
          }
        }, 5000);
      });
    },
  }));

  // Capture when image is loaded
  useEffect(() => {
    if (imageLoaded && viewShotRef.current && resolveCapture) {
      const capture = async () => {
        try {
          // Small delay to ensure render is complete
          await new Promise(r => setTimeout(r, 100));
          const capturedUri = await (viewShotRef.current!.capture as () => Promise<string>)();
          console.log("[PhotoWatermark] Captured:", capturedUri?.substring(0, 50));
          resolveCapture(capturedUri);
        } catch (e) {
          console.error("[PhotoWatermark] Capture error:", e);
          resolveCapture(photoUri!);
        } finally {
          setPhotoUri(null);
          setWatermarkData(null);
          setResolveCapture(null);
          setImageLoaded(false);
        }
      };
      capture();
    }
  }, [imageLoaded, resolveCapture]);

  if (!photoUri || !watermarkData) {
    return null;
  }

  const coords = `${watermarkData.latitude.toFixed(6)}, ${watermarkData.longitude.toFixed(6)}`;

  return (
    <View style={styles.hiddenContainer}>
      <ViewShot
        ref={viewShotRef}
        options={{ format: "jpg", quality: 0.9 }}
        style={styles.captureContainer}
      >
        <Image
          source={{ uri: photoUri }}
          style={styles.image}
          resizeMode="cover"
          onLoad={() => {
            console.log("[PhotoWatermark] Image loaded");
            setImageLoaded(true);
          }}
          onError={(e) => {
            console.error("[PhotoWatermark] Image error:", e.nativeEvent.error);
            if (resolveCapture) resolveCapture(photoUri);
          }}
        />
        <View style={styles.overlay}>
          <View style={styles.leftContent}>
            <Text style={styles.timestamp}>{watermarkData.timestamp}</Text>
            <Text style={styles.date}>{watermarkData.date}</Text>
            <Text style={styles.address}>📍 {watermarkData.address}</Text>
            <Text style={styles.coords}>🌐 {coords}</Text>
          </View>
          <View style={styles.rightContent}>
            {watermarkData.siteName && (
              <Text style={styles.siteInfo}>🏢 {watermarkData.siteName}</Text>
            )}
            {watermarkData.staffName && (
              <Text style={styles.staffInfo}>👤 {watermarkData.staffName}</Text>
            )}
          </View>
        </View>
      </ViewShot>
    </View>
  );
});

const styles = StyleSheet.create({
  hiddenContainer: {
    position: "absolute",
    left: -9999,
    top: -9999,
    opacity: 0,
  },
  captureContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.33, // 4:3 aspect ratio
    backgroundColor: "#000",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  leftContent: {
    flex: 1,
  },
  rightContent: {
    alignItems: "flex-end",
  },
  timestamp: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  date: {
    color: "#DDDDDD",
    fontSize: 14,
    marginBottom: 8,
  },
  address: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 2,
  },
  coords: {
    color: "#AAAAAA",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  siteInfo: {
    color: "#CCCCCC",
    fontSize: 12,
    marginBottom: 4,
  },
  staffInfo: {
    color: "#CCCCCC",
    fontSize: 12,
  },
});
