import React, { useRef, useImperativeHandle, forwardRef } from "react";
import { View, Text, Image, StyleSheet, Dimensions } from "react-native";
import ViewShot from "react-native-view-shot";

export interface WatermarkData {
  timestamp: string;
  address: string;
  latitude: number;
  longitude: number;
  staffName?: string;
  siteName?: string;
}

export interface WatermarkCaptureRef {
  capture: () => Promise<string>;
}

interface WatermarkCaptureProps {
  photoUri: string;
  watermarkData: WatermarkData;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export const WatermarkCapture = forwardRef<WatermarkCaptureRef, WatermarkCaptureProps>(
  ({ photoUri, watermarkData }, ref) => {
    const viewShotRef = useRef<ViewShot>(null);

    useImperativeHandle(ref, () => ({
      capture: async () => {
        if (!viewShotRef.current || !viewShotRef.current.capture) {
          throw new Error("ViewShot ref not available");
        }
        const uri = await (viewShotRef.current.capture as () => Promise<string>)();
        return uri;
      },
    }));

    const coords = `${watermarkData.latitude.toFixed(6)}, ${watermarkData.longitude.toFixed(6)}`;

    return (
      <ViewShot
        ref={viewShotRef}
        options={{ format: "jpg", quality: 0.9 }}
        style={styles.container}
      >
        <Image source={{ uri: photoUri }} style={styles.image} resizeMode="cover" />
        <View style={styles.overlay}>
          <View style={styles.leftContent}>
            <Text style={styles.timestamp}>{watermarkData.timestamp}</Text>
            <Text style={styles.address}>📍 {watermarkData.address}</Text>
            <Text style={styles.coords}>🌐 {coords}</Text>
          </View>
          <View style={styles.rightContent}>
            {watermarkData.siteName && (
              <Text style={styles.siteInfo}>🏢 {watermarkData.siteName}</Text>
            )}
            {watermarkData.staffName && (
              <Text style={styles.siteInfo}>👤 {watermarkData.staffName}</Text>
            )}
          </View>
        </View>
      </ViewShot>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    aspectRatio: 3 / 4,
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
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  leftContent: {
    flex: 1,
  },
  rightContent: {
    alignItems: "flex-end",
  },
  timestamp: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  address: {
    color: "#F0F0F0",
    fontSize: 14,
    marginBottom: 2,
  },
  coords: {
    color: "#CCCCCC",
    fontSize: 12,
  },
  siteInfo: {
    color: "#AAAAAA",
    fontSize: 12,
    marginBottom: 2,
  },
});
