import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface PairedStaff {
  pairCode: string;
  staffName: string;
  addedAt: string;
  lastLocation?: {
    latitude: number;
    longitude: number;
    timestamp: string;
  };
}

export default function WatcherScreen() {
  const colors = useColors();
  const [pairCode, setPairCode] = useState("");
  const [pairedStaff, setPairedStaff] = useState<PairedStaff[]>([]);

  useEffect(() => {
    loadPairedStaff();
  }, []);

  const loadPairedStaff = async () => {
    try {
      const staffJson = await AsyncStorage.getItem("pairedStaff");
      if (staffJson) {
        const staff: PairedStaff[] = JSON.parse(staffJson);
        setPairedStaff(staff);
      }
    } catch (error) {
      console.error("Error loading paired staff:", error);
    }
  };

  const addStaff = async () => {
    if (!pairCode.trim()) {
      Alert.alert("Enter Code", "Please enter a pair code to add staff.");
      return;
    }

    const code = pairCode.trim().toUpperCase();
    
    // Check if already paired
    if (pairedStaff.some((s) => s.pairCode === code)) {
      Alert.alert("Already Paired", "This staff member is already in your list.");
      return;
    }

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const newStaff: PairedStaff = {
      pairCode: code,
      staffName: `Staff ${code}`,
      addedAt: new Date().toISOString(),
    };

    const updatedList = [...pairedStaff, newStaff];
    await AsyncStorage.setItem("pairedStaff", JSON.stringify(updatedList));
    setPairedStaff(updatedList);
    setPairCode("");

    Alert.alert("Staff Added", `Staff with code ${code} has been added to your watch list.`);
  };

  const removeStaff = async (code: string) => {
    Alert.alert("Remove Staff", "Are you sure you want to remove this staff member?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          if (Platform.OS !== "web") {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          
          const updatedList = pairedStaff.filter((s) => s.pairCode !== code);
          await AsyncStorage.setItem("pairedStaff", JSON.stringify(updatedList));
          setPairedStaff(updatedList);
        },
      },
    ]);
  };

  const viewOnMap = (staff: PairedStaff) => {
    if (!staff.lastLocation) {
      Alert.alert("No Location", "No location data available for this staff member yet.");
      return;
    }

    const { latitude, longitude } = staff.lastLocation;
    const url = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=16`;
    Linking.openURL(url);
  };

  const viewAllOnMap = () => {
    const staffWithLocation = pairedStaff.filter((s) => s.lastLocation);
    
    if (staffWithLocation.length === 0) {
      Alert.alert("No Locations", "No staff members have location data yet.");
      return;
    }

    // Calculate center of all locations
    const avgLat =
      staffWithLocation.reduce((sum, s) => sum + (s.lastLocation?.latitude || 0), 0) /
      staffWithLocation.length;
    const avgLng =
      staffWithLocation.reduce((sum, s) => sum + (s.lastLocation?.longitude || 0), 0) /
      staffWithLocation.length;

    const url = `https://www.openstreetmap.org/?mlat=${avgLat}&mlon=${avgLng}&zoom=14`;
    Linking.openURL(url);
  };

  const renderStaffItem = ({ item }: { item: PairedStaff }) => (
    <View style={[styles.staffCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.staffHeader}>
        <View style={styles.staffInfo}>
          <Text style={[styles.staffName, { color: colors.foreground }]}>{item.staffName}</Text>
          <Text style={[styles.staffCode, { color: colors.muted }]}>Code: {item.pairCode}</Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: item.lastLocation ? colors.success : colors.muted }]} />
      </View>
      
      {item.lastLocation ? (
        <View style={styles.locationInfo}>
          <Text style={[styles.locationText, { color: colors.muted }]}>
            {item.lastLocation.latitude.toFixed(6)}, {item.lastLocation.longitude.toFixed(6)}
          </Text>
          <Text style={[styles.timestampText, { color: colors.muted }]}>
            Updated: {new Date(item.lastLocation.timestamp).toLocaleTimeString()}
          </Text>
        </View>
      ) : (
        <Text style={[styles.noLocationText, { color: colors.muted }]}>
          Waiting for location data...
        </Text>
      )}

      <View style={styles.staffActions}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={() => viewOnMap(item)}
        >
          <Text style={styles.actionButtonText}>View on Map</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.error }]}
          onPress={() => removeStaff(item.pairCode)}
        >
          <Text style={styles.actionButtonText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScreenContainer className="flex-1">
      <View className="p-6">
        {/* Header */}
        <Text className="text-3xl font-bold text-foreground mb-2">Watcher</Text>
        <Text className="text-muted mb-6">Monitor multiple staff members in real-time</Text>

        {/* Add Staff Input */}
        <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.inputLabel, { color: colors.foreground }]}>Add Staff by Pair Code</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.foreground,
                },
              ]}
              placeholder="Enter pair code"
              placeholderTextColor={colors.muted}
              value={pairCode}
              onChangeText={setPairCode}
              autoCapitalize="characters"
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={addStaff}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* View All Button */}
        {pairedStaff.length > 1 && (
          <TouchableOpacity
            style={[styles.viewAllButton, { backgroundColor: colors.primary }]}
            onPress={viewAllOnMap}
          >
            <Text style={styles.viewAllButtonText}>View All on Map ({pairedStaff.length} staff)</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Staff List */}
      {pairedStaff.length === 0 ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-muted text-center text-lg">
            No staff members added yet.{"\n"}Enter a pair code to start watching.
          </Text>
        </View>
      ) : (
        <FlatList
          data={pairedStaff}
          renderItem={renderStaffItem}
          keyExtractor={(item) => item.pairCode}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  inputCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  input: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    letterSpacing: 2,
  },
  addButton: {
    paddingHorizontal: 24,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  viewAllButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  viewAllButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  listContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  staffCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  staffHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  staffCode: {
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  locationInfo: {
    marginBottom: 12,
  },
  locationText: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 4,
  },
  timestampText: {
    fontSize: 12,
  },
  noLocationText: {
    fontSize: 13,
    fontStyle: "italic",
    marginBottom: 12,
  },
  staffActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
