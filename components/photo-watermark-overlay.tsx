import { View, Text, StyleSheet } from "react-native";

interface PhotoWatermarkOverlayProps {
  timestamp: string;
  date: string;
  address: string;
  latitude: number;
  longitude: number;
  staffName?: string;
  siteName?: string;
}

/**
 * Watermark overlay component that displays timestamp, location, and GPS coordinates
 * This is rendered as a UI overlay (not burned into the image) for instant display
 */
export function PhotoWatermarkOverlay({
  timestamp,
  date,
  address,
  latitude,
  longitude,
  staffName,
  siteName,
}: PhotoWatermarkOverlayProps) {
  return (
    <View style={styles.overlay} pointerEvents="none">
      <View style={styles.watermarkBox}>
        <Text style={styles.timestamp}>{timestamp}</Text>
        <Text style={styles.date}>{date}</Text>
        <Text style={styles.location} numberOfLines={2}>
          📍 {address}
        </Text>
        <Text style={styles.coords}>
          🌐 {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </Text>
        {staffName && (
          <Text style={styles.staff}>👤 {staffName}</Text>
        )}
        {siteName && (
          <Text style={styles.site}>🏢 {siteName}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    padding: 16,
  },
  watermarkBox: {
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  timestamp: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "monospace",
  },
  date: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  location: {
    color: "#FFFFFF",
    fontSize: 12,
    marginTop: 4,
  },
  coords: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "monospace",
  },
  staff: {
    color: "#FFFFFF",
    fontSize: 11,
    marginTop: 4,
  },
  site: {
    color: "#FFFFFF",
    fontSize: 11,
  },
});
