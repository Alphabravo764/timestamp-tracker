import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/use-colors";

export type SyncStatus = "idle" | "syncing" | "success" | "error";

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  message?: string;
}

/**
 * SyncStatusIndicator - Shows sync status with visual feedback
 * 
 * Displays a small badge indicating when data is being synced to the server.
 * Provides transparency about background sync operations.
 */
export function SyncStatusIndicator({ status, message }: SyncStatusIndicatorProps) {
  const colors = useColors();

  if (status === "idle") {
    return null; // Don't show anything when idle
  }

  const getStatusColor = () => {
    switch (status) {
      case "syncing":
        return colors.primary;
      case "success":
        return "#22C55E"; // Green
      case "error":
        return "#EF4444"; // Red
      default:
        return colors.muted;
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "syncing":
        return <ActivityIndicator size="small" color="#FFFFFF" />;
      case "success":
        return <Text style={styles.icon}>✓</Text>;
      case "error":
        return <Text style={styles.icon}>!</Text>;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    if (message) return message;
    
    switch (status) {
      case "syncing":
        return "Syncing...";
      case "success":
        return "Synced";
      case "error":
        return "Sync failed";
      default:
        return "";
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: getStatusColor() }]}>
      {getStatusIcon()}
      <Text style={styles.text}>{getStatusText()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  icon: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  text: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
});
