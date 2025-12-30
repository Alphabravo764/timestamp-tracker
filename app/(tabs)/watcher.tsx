import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  Platform,
  Linking,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getActiveShift } from "@/lib/shift-storage";
import type { Shift } from "@/lib/shift-types";
import { generateStaticMapUrl } from "@/lib/google-maps";

interface WatchedStaff {
  pairCode: string;
  addedAt: string;
  shift?: Shift | null;
}

export default function WatcherScreen() {
  const colors = useColors();
  const [pairCode, setPairCode] = useState("");
  const [watchedStaff, setWatchedStaff] = useState<WatchedStaff[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadWatchedStaff();
    }, [])
  );

  const loadWatchedStaff = async () => {
    try {
      const json = await AsyncStorage.getItem("watchedStaff");
      if (json) {
        const staff: WatchedStaff[] = JSON.parse(json);
        // Try to find active shift for each
        await refreshStaffData(staff);
      }
    } catch (e) {
      console.error("Load error:", e);
    }
  };

  const refreshStaffData = async (staff: WatchedStaff[]) => {
    setIsRefreshing(true);
    try {
      // Get active shift from local storage
      const activeShift = await getActiveShift();
      
      // Update each staff with shift data if pair code matches
      const updated = staff.map(s => {
        if (activeShift && activeShift.pairCode === s.pairCode) {
          return { ...s, shift: activeShift };
        }
        return { ...s, shift: null };
      });
      
      setWatchedStaff(updated);
      await AsyncStorage.setItem("watchedStaff", JSON.stringify(updated));
    } catch (e) {
      console.error("Refresh error:", e);
    }
    setIsRefreshing(false);
  };

  const addStaff = async () => {
    const code = pairCode.trim().toUpperCase();
    if (!code) {
      alert("Please enter a pair code.");
      return;
    }
    
    if (watchedStaff.some(s => s.pairCode === code)) {
      alert("This code is already in your list.");
      return;
    }

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const newStaff: WatchedStaff = {
      pairCode: code,
      addedAt: new Date().toISOString(),
    };

    const updated = [...watchedStaff, newStaff];
    setWatchedStaff(updated);
    await AsyncStorage.setItem("watchedStaff", JSON.stringify(updated));
    setPairCode("");
    
    // Try to find matching shift
    await refreshStaffData(updated);
    
    alert(`Staff with code ${code} added.`);
  };

  const removeStaff = async (code: string) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    const updated = watchedStaff.filter(s => s.pairCode !== code);
    setWatchedStaff(updated);
    await AsyncStorage.setItem("watchedStaff", JSON.stringify(updated));
  };

  const viewOnMap = (staff: WatchedStaff) => {
    if (!staff.shift || staff.shift.locations.length === 0) {
      alert("No location data available for this staff member.");
      return;
    }

    // Open live viewer page with Google Maps trail
    const baseUrl = Platform.OS === "web" ? window.location.origin : "https://timestamp-tracker.app";
    const liveUrl = `${baseUrl}/live/${staff.pairCode}`;
    Linking.openURL(liveUrl);
  };

  const viewTrailMap = (staff: WatchedStaff) => {
    if (!staff.shift || staff.shift.locations.length === 0) {
      alert("No location data available.");
      return;
    }
    
    // Generate Google Maps directions URL with trail
    const locs = staff.shift.locations;
    const start = locs[0];
    const end = locs[locs.length - 1];
    
    // Use Google Maps directions for trail visualization
    let url = `https://www.google.com/maps/dir/?api=1`;
    url += `&origin=${start.latitude},${start.longitude}`;
    url += `&destination=${end.latitude},${end.longitude}`;
    url += `&travelmode=walking`;
    
    // Add waypoints if more than 2 locations (max 10 for URL)
    if (locs.length > 2) {
      const waypoints = locs.slice(1, -1).slice(0, 8).map(l => `${l.latitude},${l.longitude}`).join("|");
      url += `&waypoints=${encodeURIComponent(waypoints)}`;
    }
    
    Linking.openURL(url);
  };

  const renderStaffItem = ({ item }: { item: WatchedStaff }) => {
    const hasShift = item.shift && item.shift.isActive;
    const lastLoc = item.shift?.locations?.[item.shift.locations.length - 1];
    
    return (
      <View style={[styles.staffCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.staffHeader}>
          <View style={styles.staffInfo}>
            <Text style={[styles.staffCode, { color: colors.foreground }]}>Code: {item.pairCode}</Text>
            {hasShift && (
              <Text style={[styles.staffSite, { color: colors.muted }]}>
                {item.shift?.siteName} • {item.shift?.staffName}
              </Text>
            )}
          </View>
          <View style={[styles.statusDot, { backgroundColor: hasShift ? colors.success : colors.muted }]} />
        </View>
        
        {hasShift && lastLoc ? (
          <View style={styles.locationInfo}>
            <Text style={[styles.locationText, { color: colors.muted }]}>
              {lastLoc.latitude.toFixed(6)}, {lastLoc.longitude.toFixed(6)}
            </Text>
            <Text style={[styles.timestampText, { color: colors.muted }]}>
              {new Date(lastLoc.timestamp).toLocaleString()}
            </Text>
            <Text style={[styles.statsText, { color: colors.muted }]}>
              📍 {item.shift?.locations.length} locations • 📷 {item.shift?.photos.length} photos
            </Text>
          </View>
        ) : (
          <Text style={[styles.noDataText, { color: colors.muted }]}>
            {hasShift ? "No location data yet" : "No active shift found"}
          </Text>
        )}

        <View style={styles.staffActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: hasShift ? colors.primary : colors.muted }]}
            onPress={() => viewOnMap(item)}
            disabled={!hasShift}
          >
            <Text style={styles.actionBtnText}>📱 Live View</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: hasShift ? colors.success : colors.muted }]}
            onPress={() => viewTrailMap(item)}
            disabled={!hasShift}
          >
            <Text style={styles.actionBtnText}>🗺️ Trail</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.error }]}
            onPress={() => removeStaff(item.pairCode)}
          >
            <Text style={styles.actionBtnText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer className="flex-1">
      <View className="p-6">
        <Text className="text-3xl font-bold text-foreground mb-2">Watch Staff</Text>
        <Text className="text-muted mb-6">Monitor staff members by their pair code</Text>

        {/* Add Staff */}
        <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.inputLabel, { color: colors.foreground }]}>Add Staff by Pair Code</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Enter code"
              placeholderTextColor={colors.muted}
              value={pairCode}
              onChangeText={setPairCode}
              autoCapitalize="characters"
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.primary }]}
              onPress={addStaff}
            >
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Refresh Button */}
        {watchedStaff.length > 0 && (
          <TouchableOpacity
            style={[styles.refreshBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => refreshStaffData(watchedStaff)}
            disabled={isRefreshing}
          >
            <Text style={[styles.refreshBtnText, { color: colors.primary }]}>
              {isRefreshing ? "Refreshing..." : "🔄 Refresh All"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Staff List */}
      {watchedStaff.length === 0 ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-muted text-center text-lg mb-4">
            No staff members added yet.
          </Text>
          <Text className="text-muted text-center text-sm">
            Enter a pair code from a staff member{"\n"}to start watching their location.
          </Text>
        </View>
      ) : (
        <FlatList
          data={watchedStaff}
          renderItem={renderStaffItem}
          keyExtractor={item => item.pairCode}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  inputCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  inputLabel: { fontSize: 14, fontWeight: "600", marginBottom: 12 },
  inputRow: { flexDirection: "row", gap: 12 },
  input: { flex: 1, height: 48, borderRadius: 8, borderWidth: 1, paddingHorizontal: 16, fontSize: 18, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", letterSpacing: 4, textAlign: "center" },
  addBtn: { paddingHorizontal: 24, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  addBtnText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  refreshBtn: { padding: 12, borderRadius: 8, borderWidth: 1, alignItems: "center", marginBottom: 8 },
  refreshBtnText: { fontSize: 14, fontWeight: "600" },
  listContainer: { paddingHorizontal: 24, paddingBottom: 24 },
  staffCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  staffHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  staffInfo: { flex: 1 },
  staffCode: { fontSize: 18, fontWeight: "bold", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", letterSpacing: 2 },
  staffSite: { fontSize: 14, marginTop: 4 },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  locationInfo: { marginBottom: 12 },
  locationText: { fontSize: 13, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", marginBottom: 4 },
  timestampText: { fontSize: 12, marginBottom: 4 },
  statsText: { fontSize: 12 },
  noDataText: { fontSize: 13, fontStyle: "italic", marginBottom: 12 },
  staffActions: { flexDirection: "row", gap: 12 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  actionBtnText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
});
