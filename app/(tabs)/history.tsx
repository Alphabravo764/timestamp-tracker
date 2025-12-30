import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  Platform,
  Linking,
  ScrollView,
  Image,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import {
  getShiftHistory,
  deleteShift,
  formatDuration,
  getShiftDuration,
} from "@/lib/shift-storage";
import type { Shift, LocationPoint } from "@/lib/shift-types";
import { openPDFReport } from "@/lib/pdf-generator";

// Generate trail map URL that shows all points
const getTrailMapUrl = (locations: LocationPoint[]): string => {
  if (locations.length === 0) return "";
  if (locations.length === 1) {
    const loc = locations[0];
    return `https://www.openstreetmap.org/?mlat=${loc.latitude}&mlon=${loc.longitude}&zoom=17`;
  }
  // Create bounding box for all locations
  const lats = locations.map(l => l.latitude);
  const lngs = locations.map(l => l.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const padding = 0.001;
  return `https://www.openstreetmap.org/?bbox=${minLng - padding},${minLat - padding},${maxLng + padding},${maxLat + padding}&layer=mapnik`;
};

// Reverse geocoding using Nominatim
const getAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { "User-Agent": "TimestampCamera/1.0" } }
    );
    const data = await response.json();
    if (data.address) {
      const { road, house_number, postcode, city, town, village } = data.address;
      const street = house_number ? `${house_number} ${road}` : road;
      const area = city || town || village || "";
      const parts = [street, area, postcode].filter(Boolean);
      return parts.join(", ") || "Unknown location";
    }
    return "Unknown location";
  } catch (e) {
    return "Location unavailable";
  }
};

export default function HistoryScreen() {
  const colors = useColors();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [startAddress, setStartAddress] = useState<string>("");
  const [endAddress, setEndAddress] = useState<string>("");

  useFocusEffect(
    useCallback(() => {
      loadShifts();
    }, [])
  );

  const loadShifts = async () => {
    const history = await getShiftHistory();
    setShifts(history);
  };

  const loadAddresses = async (shift: Shift) => {
    if (shift.locations.length > 0) {
      const first = shift.locations[0];
      const last = shift.locations[shift.locations.length - 1];
      
      const startAddr = first.address || await getAddressFromCoords(first.latitude, first.longitude);
      const endAddr = last.address || await getAddressFromCoords(last.latitude, last.longitude);
      
      setStartAddress(startAddr);
      setEndAddress(endAddr);
    }
  };

  const handleSelectShift = async (shift: Shift) => {
    setSelectedShift(shift);
    setStartAddress("Loading...");
    setEndAddress("Loading...");
    await loadAddresses(shift);
  };

  const handleDeleteShift = (shiftId: string) => {
    if (Platform.OS === "web") {
      if (confirm("Are you sure you want to delete this shift record?")) {
        deleteShift(shiftId).then(() => {
          loadShifts();
          setSelectedShift(null);
        });
      }
    } else {
      Alert.alert("Delete Shift", "Are you sure you want to delete this shift record?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteShift(shiftId);
            await loadShifts();
            setSelectedShift(null);
          },
        },
      ]);
    }
  };

  const viewTrailOnMap = (shift: Shift) => {
    if (shift.locations.length === 0) {
      alert("No location data for this shift.");
      return;
    }
    const url = getTrailMapUrl(shift.locations);
    Linking.openURL(url);
  };

  const generateReport = async (shift: Shift) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const duration = formatDuration(getShiftDuration(shift));
    const startDate = new Date(shift.startTime).toLocaleString();
    const endDate = shift.endTime ? new Date(shift.endTime).toLocaleString() : "In Progress";

    // Build report text
    let report = `📋 SHIFT REPORT\n`;
    report += `═══════════════════════════\n\n`;
    report += `📍 Site: ${shift.siteName}\n`;
    report += `👤 Staff: ${shift.staffName}\n`;
    report += `🔑 Pair Code: ${shift.pairCode}\n\n`;
    report += `⏰ TIMING\n`;
    report += `───────────────────────────\n`;
    report += `Start: ${startDate}\n`;
    report += `End: ${endDate}\n`;
    report += `Duration: ${duration}\n\n`;
    report += `📊 STATISTICS\n`;
    report += `───────────────────────────\n`;
    report += `Location Points: ${shift.locations.length}\n`;
    report += `Photos Taken: ${shift.photos.length}\n\n`;

    if (shift.locations.length > 0) {
      report += `🗺️ LOCATION TRAIL\n`;
      report += `───────────────────────────\n`;
      
      const first = shift.locations[0];
      const last = shift.locations[shift.locations.length - 1];
      
      report += `START LOCATION:\n`;
      report += `  📍 ${startAddress || `${first.latitude.toFixed(6)}, ${first.longitude.toFixed(6)}`}\n`;
      report += `  🕐 ${new Date(first.timestamp).toLocaleTimeString()}\n\n`;
      
      report += `END LOCATION:\n`;
      report += `  📍 ${endAddress || `${last.latitude.toFixed(6)}, ${last.longitude.toFixed(6)}`}\n`;
      report += `  🕐 ${new Date(last.timestamp).toLocaleTimeString()}\n\n`;

      // Trail map link
      report += `VIEW TRAIL MAP:\n`;
      report += `${getTrailMapUrl(shift.locations)}\n\n`;
    }

    if (shift.photos.length > 0) {
      report += `📷 PHOTOS\n`;
      report += `───────────────────────────\n`;
      shift.photos.forEach((photo, index) => {
        report += `${index + 1}. ${new Date(photo.timestamp).toLocaleString()}\n`;
        if (photo.address) {
          report += `   📍 ${photo.address}\n`;
        } else if (photo.location) {
          report += `   📍 ${photo.location.latitude.toFixed(6)}, ${photo.location.longitude.toFixed(6)}\n`;
        }
      });
    }

    report += `\n═══════════════════════════\n`;
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += `Timestamp Camera App\n`;

    try {
      await Share.share({
        message: report,
        title: `Shift Report - ${shift.siteName}`,
      });
    } catch (error) {
      console.error("Error sharing report:", error);
    }
  };

  // Shift Detail View
  if (selectedShift) {
    const duration = formatDuration(getShiftDuration(selectedShift));

    return (
      <ScreenContainer>
        <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedShift(null)}>
              <Text style={[styles.backButton, { color: colors.primary }]}>← Back</Text>
            </TouchableOpacity>
          </View>

          <Text className="text-2xl font-bold text-foreground mb-1">{selectedShift.siteName}</Text>
          <Text className="text-muted mb-6">{selectedShift.staffName} • {selectedShift.pairCode}</Text>

          {/* Stats Cards */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{duration}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Duration</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{selectedShift.photos.length}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Photos</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{selectedShift.locations.length}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Locations</Text>
            </View>
          </View>

          {/* Time Info */}
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.foreground }]}>⏰ Shift Time</Text>
            <Text style={[styles.infoText, { color: colors.muted }]}>
              Start: {new Date(selectedShift.startTime).toLocaleString()}
            </Text>
            <Text style={[styles.infoText, { color: colors.muted }]}>
              End: {selectedShift.endTime ? new Date(selectedShift.endTime).toLocaleString() : "In Progress"}
            </Text>
          </View>

          {/* Location Trail */}
          {selectedShift.locations.length > 0 && (
            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.infoTitle, { color: colors.foreground }]}>🗺️ Location Trail</Text>
              
              <View style={styles.locationItem}>
                <Text style={[styles.locationLabel, { color: colors.success }]}>START</Text>
                <Text style={[styles.locationAddress, { color: colors.foreground }]}>{startAddress}</Text>
                <Text style={[styles.locationTime, { color: colors.muted }]}>
                  {new Date(selectedShift.locations[0].timestamp).toLocaleTimeString()}
                </Text>
              </View>
              
              {selectedShift.locations.length > 1 && (
                <View style={styles.locationItem}>
                  <Text style={[styles.locationLabel, { color: colors.error }]}>END</Text>
                  <Text style={[styles.locationAddress, { color: colors.foreground }]}>{endAddress}</Text>
                  <Text style={[styles.locationTime, { color: colors.muted }]}>
                    {new Date(selectedShift.locations[selectedShift.locations.length - 1].timestamp).toLocaleTimeString()}
                  </Text>
                </View>
              )}
              
              <Text style={[styles.locationCount, { color: colors.muted }]}>
                {selectedShift.locations.length} location points recorded
              </Text>
            </View>
          )}

          {/* Photos */}
          {selectedShift.photos.length > 0 && (
            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.infoTitle, { color: colors.foreground }]}>📷 Photos ({selectedShift.photos.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                {selectedShift.photos.map((photo) => (
                  <View key={photo.id} style={styles.photoContainer}>
                    <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} />
                    <Text style={[styles.photoTime, { color: colors.muted }]}>
                      {new Date(photo.timestamp).toLocaleTimeString()}
                    </Text>
                    {photo.address && (
                      <Text style={[styles.photoAddress, { color: colors.muted }]} numberOfLines={1}>
                        {photo.address.split(",")[0]}
                      </Text>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Action Buttons */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => openPDFReport(selectedShift)}
          >
            <Text style={styles.actionButtonText}>📄 View PDF Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#6366f1" }]}
            onPress={() => generateReport(selectedShift)}
          >
            <Text style={styles.actionButtonText}>📤 Share as Text</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.success }]}
            onPress={() => viewTrailOnMap(selectedShift)}
          >
            <Text style={styles.actionButtonText}>🗺️ View Trail on Map</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.error }]}
            onPress={() => handleDeleteShift(selectedShift.id)}
          >
            <Text style={styles.actionButtonText}>🗑️ Delete Shift</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </ScreenContainer>
    );
  }

  // Shift List
  const renderShiftItem = ({ item }: { item: Shift }) => {
    const duration = formatDuration(getShiftDuration(item));
    const date = new Date(item.startTime).toLocaleDateString();
    const time = new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity
        style={[styles.shiftCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => handleSelectShift(item)}
      >
        <View style={styles.shiftHeader}>
          <Text style={[styles.shiftSite, { color: colors.foreground }]}>{item.siteName}</Text>
          <Text style={[styles.shiftDate, { color: colors.muted }]}>{date}</Text>
        </View>
        <Text style={[styles.shiftStaff, { color: colors.muted }]}>{item.staffName} • {time}</Text>
        <View style={styles.shiftStats}>
          <Text style={[styles.shiftStat, { color: colors.muted }]}>⏱️ {duration}</Text>
          <Text style={[styles.shiftStat, { color: colors.muted }]}>📷 {item.photos.length}</Text>
          <Text style={[styles.shiftStat, { color: colors.muted }]}>📍 {item.locations.length}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer className="flex-1">
      <View className="p-6 pb-0">
        <Text className="text-3xl font-bold text-foreground mb-2">Shift History</Text>
        <Text className="text-muted mb-4">View past shifts and generate reports</Text>
      </View>

      {shifts.length === 0 ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-muted text-center text-lg">
            No completed shifts yet.{"\n"}Start and end a shift to see it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={shifts}
          renderItem={renderShiftItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    padding: 24,
    paddingTop: 8,
  },
  shiftCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  shiftHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  shiftSite: {
    fontSize: 18,
    fontWeight: "600",
  },
  shiftDate: {
    fontSize: 14,
  },
  shiftStaff: {
    fontSize: 14,
    marginBottom: 8,
  },
  shiftStats: {
    flexDirection: "row",
    gap: 16,
  },
  shiftStat: {
    fontSize: 13,
  },
  detailHeader: {
    marginBottom: 16,
  },
  backButton: {
    fontSize: 16,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 4,
  },
  locationItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 2,
  },
  locationTime: {
    fontSize: 12,
  },
  locationCount: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },
  photoScroll: {
    marginTop: 8,
  },
  photoContainer: {
    marginRight: 12,
    alignItems: "center",
    width: 90,
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  photoTime: {
    fontSize: 11,
    marginTop: 4,
  },
  photoAddress: {
    fontSize: 10,
    textAlign: "center",
  },
  actionButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
