import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList, Platform, Linking } from "react-native";
import { useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Shift } from "@/lib/shift-types";
// Use Railway production URL for API calls
const RAILWAY_API_URL = "https://timestamp-tracker-production.up.railway.app";

interface WatchedStaff {
  pairCode: string;
  addedAt: string;
  shift?: Shift | null;
  lastFetched?: string;
  error?: string;
}

async function fetchShiftByPairCode(pairCode: string): Promise<Shift | null> {
  try {
    const apiUrl = RAILWAY_API_URL;
    const normalizedCode = pairCode.replace(/-/g, "").toUpperCase();
    const response = await fetch(`${apiUrl}/api/trpc/shifts.getByPairCode?input=${encodeURIComponent(JSON.stringify({ json: { pairCode: normalizedCode } }))}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) return null;
    const result = await response.json();
    const data = result?.result?.data?.json;
    if (!data || !data.shift) return null;
    return {
      id: data.shift.id,
      siteName: data.shift.siteName,
      staffName: data.shift.staffName || "Staff",
      pairCode: data.shift.pairCode,
      startTime: new Date(data.shift.startTime).toISOString(),
      endTime: data.shift.endTime ? new Date(data.shift.endTime).toISOString() : null,
      isActive: data.shift.status === "active",
      locations: data.locations.map((loc: any) => ({ latitude: loc.latitude, longitude: loc.longitude, address: loc.address, timestamp: new Date(loc.timestamp).toISOString(), accuracy: loc.accuracy })),
      photos: data.photos.map((photo: any) => ({ id: photo.id, uri: photo.uri, timestamp: new Date(photo.timestamp).toISOString(), address: photo.address, location: photo.latitude && photo.longitude ? { latitude: photo.latitude, longitude: photo.longitude, timestamp: new Date(photo.timestamp).toISOString() } : null })),
      notes: [],
    };
  } catch (e) {
    return null;
  }
}

export default function WatcherScreen() {
  const colors = useColors();
  const [pairCode, setPairCode] = useState("");
  const [watchedStaff, setWatchedStaff] = useState<WatchedStaff[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { loadWatchedStaff(); }, []));

  const loadWatchedStaff = async () => {
    try {
      const json = await AsyncStorage.getItem("watchedStaff");
      if (json) {
        const staff: WatchedStaff[] = JSON.parse(json);
        setWatchedStaff(staff);
        await refreshStaffData(staff);
      }
    } catch (e) {}
  };

  const refreshStaffData = async (staff: WatchedStaff[]) => {
    setIsRefreshing(true);
    const updated = await Promise.all(staff.map(async (s) => {
      const shift = await fetchShiftByPairCode(s.pairCode);
      return { ...s, shift, lastFetched: new Date().toISOString(), error: shift ? undefined : "No active shift found" };
    }));
    setWatchedStaff(updated);
    await AsyncStorage.setItem("watchedStaff", JSON.stringify(updated));
    setIsRefreshing(false);
  };

  const addStaff = async () => {
    const code = pairCode.trim().toUpperCase().replace(/-/g, "");
    if (!code || code.length < 6) { alert("Please enter a valid 6-character pair code."); return; }
    const formattedCode = `${code.slice(0, 3)}-${code.slice(3, 6)}`;
    if (watchedStaff.some(s => s.pairCode.replace(/-/g, "") === code)) { alert("This code is already in your list."); return; }
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const shift = await fetchShiftByPairCode(formattedCode);
    const newStaff: WatchedStaff = { pairCode: formattedCode, addedAt: new Date().toISOString(), shift, lastFetched: new Date().toISOString(), error: shift ? undefined : "No active shift found" };
    const updated = [...watchedStaff, newStaff];
    setWatchedStaff(updated);
    await AsyncStorage.setItem("watchedStaff", JSON.stringify(updated));
    setPairCode("");
    alert(shift ? `✓ Found shift for ${shift.staffName} at ${shift.siteName}` : `Staff with code ${formattedCode} added. No active shift found yet.`);
  };

  const removeStaff = async (code: string) => {
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = watchedStaff.filter(s => s.pairCode !== code);
    setWatchedStaff(updated);
    await AsyncStorage.setItem("watchedStaff", JSON.stringify(updated));
  };

  const viewLive = (staff: WatchedStaff) => {
    const baseUrl = Platform.OS === "web" ? window.location.origin : RAILWAY_API_URL;
    Linking.openURL(`${baseUrl}/viewer/${staff.pairCode.replace(/-/g, "")}`);
  };

  const viewTrailMap = (staff: WatchedStaff) => {
    if (!staff.shift || staff.shift.locations.length === 0) { alert("No location data available."); return; }
    const locs = staff.shift.locations;
    let url = `https://www.google.com/maps/dir/?api=1&origin=${locs[0].latitude},${locs[0].longitude}&destination=${locs[locs.length - 1].latitude},${locs[locs.length - 1].longitude}&travelmode=walking`;
    if (locs.length > 2) url += `&waypoints=${encodeURIComponent(locs.slice(1, -1).slice(0, 8).map(l => `${l.latitude},${l.longitude}`).join("|"))}`;
    Linking.openURL(url);
  };

  const renderStaffItem = ({ item }: { item: WatchedStaff }) => {
    const hasShift = item.shift && item.shift.isActive;
    const lastLoc = item.shift?.locations?.[item.shift.locations.length - 1];
    return (
      <View style={[styles.staffCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.staffHeader}>
          <View style={styles.staffInfo}>
            <Text style={[styles.staffCode, { color: colors.foreground }]}>{item.pairCode}</Text>
            {item.shift && <Text style={[styles.staffSite, { color: colors.muted }]}>{item.shift.siteName} • {item.shift.staffName}</Text>}
            {item.error && !item.shift && <Text style={[styles.errorText, { color: colors.warning }]}>{item.error}</Text>}
          </View>
          <View style={[styles.statusDot, { backgroundColor: hasShift ? colors.success : colors.muted }]} />
        </View>
        {hasShift && lastLoc ? (
          <View style={styles.locationInfo}>
            <Text style={[styles.addressText, { color: colors.foreground }]}>📍 {lastLoc.address || `${lastLoc.latitude.toFixed(6)}, ${lastLoc.longitude.toFixed(6)}`}</Text>
            <Text style={[styles.timestampText, { color: colors.muted }]}>Last update: {new Date(lastLoc.timestamp).toLocaleString()}</Text>
            <Text style={[styles.statsText, { color: colors.muted }]}>📍 {item.shift?.locations.length} locations • 📷 {item.shift?.photos.length} photos</Text>
          </View>
        ) : item.shift && !hasShift ? (
          <View style={styles.locationInfo}>
            <Text style={[styles.completedText, { color: colors.muted }]}>✓ Shift completed</Text>
            <Text style={[styles.statsText, { color: colors.muted }]}>📍 {item.shift.locations.length} locations • 📷 {item.shift.photos.length} photos</Text>
          </View>
        ) : (
          <Text style={[styles.noDataText, { color: colors.muted }]}>Waiting for shift to start...</Text>
        )}
        <View style={styles.staffActions}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: item.shift ? colors.primary : colors.muted }]} onPress={() => viewLive(item)}><Text style={styles.actionBtnText}>📱 View</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: hasShift ? colors.success : colors.muted }]} onPress={() => viewTrailMap(item)} disabled={!hasShift}><Text style={styles.actionBtnText}>🗺️ Trail</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.error }]} onPress={() => removeStaff(item.pairCode)}><Text style={styles.actionBtnText}>🗑️</Text></TouchableOpacity>
        </View>
        {item.lastFetched && <Text style={[styles.lastFetchedText, { color: colors.muted }]}>Updated: {new Date(item.lastFetched).toLocaleTimeString()}</Text>}
      </View>
    );
  };

  return (
    <ScreenContainer className="flex-1">
      <View className="p-6">
        <Text className="text-3xl font-bold text-foreground mb-2">Watch Staff</Text>
        <Text className="text-muted mb-6">Monitor staff members by their pair code</Text>
        <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.inputLabel, { color: colors.foreground }]}>Add Staff by Pair Code</Text>
          <View style={styles.inputRow}>
            <TextInput style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} placeholder="ABC123" placeholderTextColor={colors.muted} value={pairCode} onChangeText={setPairCode} autoCapitalize="characters" maxLength={7} />
            <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={addStaff}><Text style={styles.addBtnText}>Add</Text></TouchableOpacity>
          </View>
        </View>
        {watchedStaff.length > 0 && (
          <TouchableOpacity style={[styles.refreshBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => refreshStaffData(watchedStaff)} disabled={isRefreshing}>
            <Text style={[styles.refreshBtnText, { color: colors.primary }]}>{isRefreshing ? "Refreshing..." : "🔄 Refresh All"}</Text>
          </TouchableOpacity>
        )}
      </View>
      {watchedStaff.length === 0 ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-muted text-center text-lg mb-4">No staff members added yet.</Text>
          <Text className="text-muted text-center text-sm">Enter a pair code from a security guard{"\n"}to start watching their location.</Text>
        </View>
      ) : (
        <FlatList data={watchedStaff} renderItem={renderStaffItem} keyExtractor={item => item.pairCode} contentContainerStyle={styles.listContainer} showsVerticalScrollIndicator={false} />
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
  staffCode: { fontSize: 20, fontWeight: "bold", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", letterSpacing: 3 },
  staffSite: { fontSize: 14, marginTop: 4 },
  errorText: { fontSize: 12, marginTop: 4, fontStyle: "italic" },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  locationInfo: { marginBottom: 12 },
  addressText: { fontSize: 14, marginBottom: 4 },
  timestampText: { fontSize: 12, marginBottom: 4 },
  statsText: { fontSize: 12 },
  completedText: { fontSize: 13, marginBottom: 4 },
  noDataText: { fontSize: 13, fontStyle: "italic", marginBottom: 12 },
  staffActions: { flexDirection: "row", gap: 12 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  actionBtnText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  lastFetchedText: { fontSize: 10, marginTop: 8, textAlign: "right" },
});
