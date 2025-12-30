import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  RefreshControl,
  StyleSheet,
  Platform,
  Linking,
  Dimensions,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Shift, LocationPoint, ShiftPhoto } from "@/lib/shift-types";
import { generateStaticMapUrl } from "@/lib/google-maps";
import { generatePDFReport } from "@/lib/pdf-generator";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Storage keys
const ACTIVE_SHIFT_KEY = "@timestamp_camera_active_shift";
const SHIFT_HISTORY_KEY = "@timestamp_camera_shift_history";

export default function LiveViewerScreen() {
  const colors = useColors();
  const params = useLocalSearchParams();
  const token = params.token as string;

  const [shift, setShift] = useState<Shift | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<ShiftPhoto | null>(null);

  // Load shift data by pair code (token)
  const loadShiftData = useCallback(async () => {
    try {
      // First check active shift
      const activeJson = await AsyncStorage.getItem(ACTIVE_SHIFT_KEY);
      if (activeJson) {
        const activeShift = JSON.parse(activeJson) as Shift;
        if (activeShift.pairCode === token || activeShift.id === token) {
          setShift(activeShift);
          setLastUpdated(new Date());
          setIsLoading(false);
          return;
        }
      }

      // Check history
      const historyJson = await AsyncStorage.getItem(SHIFT_HISTORY_KEY);
      if (historyJson) {
        const history = JSON.parse(historyJson) as Shift[];
        const found = history.find(s => s.pairCode === token || s.id === token);
        if (found) {
          setShift(found);
          setLastUpdated(new Date());
          setIsLoading(false);
          return;
        }
      }

      // Not found
      setShift(null);
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading shift:", error);
      setIsLoading(false);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    loadShiftData();
  }, [loadShiftData]);

  // Auto-refresh for active shifts
  useEffect(() => {
    if (!shift?.isActive) return;
    
    const interval = setInterval(() => {
      loadShiftData();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [shift?.isActive, loadShiftData]);

  // Calculate elapsed time
  useEffect(() => {
    if (!shift?.isActive) {
      setElapsedTime("");
      return;
    }

    const updateElapsed = () => {
      const start = new Date(shift.startTime).getTime();
      const now = Date.now();
      const diff = now - start;

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setElapsedTime(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [shift]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadShiftData();
    setRefreshing(false);
  };

  const formatDuration = (startTime: string, endTime: string | null): string => {
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    const minutes = Math.floor((end - start) / 60000);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const openInMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url);
    }
  };

  const downloadReport = () => {
    if (!shift) return;
    
    try {
      const html = generatePDFReport(shift);
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (error) {
      console.error("PDF error:", error);
      alert("Failed to generate report. Please try again.");
    }
  };

  const viewTrailOnMap = () => {
    if (!shift || shift.locations.length === 0) return;
    
    if (shift.locations.length === 1) {
      const loc = shift.locations[0];
      openInMaps(loc.latitude, loc.longitude);
      return;
    }
    
    // Open Google Maps with directions
    const start = shift.locations[0];
    const end = shift.locations[shift.locations.length - 1];
    const url = `https://www.google.com/maps/dir/${start.latitude},${start.longitude}/${end.latitude},${end.longitude}`;
    
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.muted }]}>Loading shift data...</Text>
      </ScreenContainer>
    );
  }

  // Not found state
  if (!shift) {
    return (
      <ScreenContainer className="p-6 justify-center">
        <View style={styles.notFoundContainer}>
          <Text style={[styles.notFoundTitle, { color: colors.foreground }]}>
            Shift Not Found
          </Text>
          <Text style={[styles.notFoundText, { color: colors.muted }]}>
            This shift link is invalid or has expired.{"\n"}
            Please check the pair code and try again.
          </Text>
          <View style={[styles.codeBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.codeLabel, { color: colors.muted }]}>Pair Code Entered:</Text>
            <Text style={[styles.codeValue, { color: colors.foreground }]}>{token}</Text>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  const latestLocation = shift.locations[shift.locations.length - 1];
  const mapUrl = shift.locations.length > 0 ? generateStaticMapUrl(shift.locations, 600, 300) : "";

  return (
    <ScreenContainer>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.statusBadge, { backgroundColor: shift.isActive ? colors.success : colors.muted }]}>
            <Text style={styles.statusText}>
              {shift.isActive ? "● LIVE TRACKING" : "✓ COMPLETED"}
            </Text>
          </View>

          {shift.isActive && elapsedTime && (
            <Text style={[styles.elapsedTime, { color: colors.foreground }]}>{elapsedTime}</Text>
          )}

          <Text style={[styles.siteName, { color: colors.foreground }]}>{shift.siteName}</Text>
          <Text style={[styles.staffName, { color: colors.muted }]}>{shift.staffName}</Text>
          
          <View style={[styles.pairCodeBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.pairCodeLabel, { color: colors.muted }]}>Pair Code:</Text>
            <Text style={[styles.pairCodeValue, { color: colors.primary }]}>{shift.pairCode}</Text>
          </View>
        </View>

        {/* Trail Map */}
        {mapUrl && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>🗺️ Location Trail</Text>
            <TouchableOpacity onPress={viewTrailOnMap}>
              <Image source={{ uri: mapUrl }} style={styles.mapImage} resizeMode="cover" />
            </TouchableOpacity>
            <View style={styles.mapLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#22c55e" }]} />
                <Text style={[styles.legendText, { color: colors.muted }]}>Start</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#ef4444" }]} />
                <Text style={[styles.legendText, { color: colors.muted }]}>
                  {shift.isActive ? "Current" : "End"}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: colors.primary }]} />
                <Text style={[styles.legendText, { color: colors.muted }]}>Trail</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.mapButton, { backgroundColor: colors.primary }]}
              onPress={viewTrailOnMap}
            >
              <Text style={styles.mapButtonText}>View Full Trail on Google Maps</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Current Location (for active shifts) */}
        {shift.isActive && latestLocation && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>📍 Current Location</Text>
            <Text style={[styles.locationAddress, { color: colors.foreground }]}>
              {latestLocation.address || "Address loading..."}
            </Text>
            <Text style={[styles.locationCoords, { color: colors.muted }]}>
              {latestLocation.latitude.toFixed(6)}, {latestLocation.longitude.toFixed(6)}
            </Text>
            <Text style={[styles.locationTime, { color: colors.muted }]}>
              Updated: {new Date(latestLocation.timestamp).toLocaleTimeString()}
            </Text>
            <TouchableOpacity 
              style={[styles.locationButton, { backgroundColor: colors.primary }]}
              onPress={() => openInMaps(latestLocation.latitude, latestLocation.longitude)}
            >
              <Text style={styles.locationButtonText}>Open in Google Maps</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Shift Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {formatDuration(shift.startTime, shift.endTime)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Duration</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{shift.photos.length}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Photos</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{shift.locations.length}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Locations</Text>
          </View>
        </View>

        {/* Shift Details */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>⏰ Shift Details</Text>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.muted }]}>Started</Text>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>
              {new Date(shift.startTime).toLocaleString()}
            </Text>
          </View>
          {shift.endTime && (
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.muted }]}>Ended</Text>
              <Text style={[styles.detailValue, { color: colors.foreground }]}>
                {new Date(shift.endTime).toLocaleString()}
              </Text>
            </View>
          )}
          {shift.locations.length > 0 && (
            <>
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: colors.muted }]}>Start Location</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]} numberOfLines={2}>
                  {shift.locations[0].address || `${shift.locations[0].latitude.toFixed(4)}, ${shift.locations[0].longitude.toFixed(4)}`}
                </Text>
              </View>
              {shift.locations.length > 1 && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.muted }]}>
                    {shift.isActive ? "Current Location" : "End Location"}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.foreground }]} numberOfLines={2}>
                    {latestLocation?.address || `${latestLocation?.latitude.toFixed(4)}, ${latestLocation?.longitude.toFixed(4)}`}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Photos */}
        {shift.photos.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              📷 Photos ({shift.photos.length})
            </Text>
            <View style={styles.photoGrid}>
              {shift.photos.map((photo) => (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.photoGridItem}
                  onPress={() => setSelectedPhoto(photo)}
                >
                  <Image source={{ uri: photo.uri }} style={styles.photoGridImage} />
                  <View style={[styles.photoOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
                    <Text style={styles.photoTime}>
                      {new Date(photo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.photoHint, { color: colors.muted }]}>
              Tap a photo to view full size
            </Text>
          </View>
        )}

        {/* Download Report Button */}
        <View style={[styles.downloadCard, { backgroundColor: shift.isActive ? colors.surface : colors.primary + "15", borderColor: shift.isActive ? colors.border : colors.primary + "30" }]}>
          <Text style={[styles.downloadTitle, { color: colors.foreground }]}>
            {shift.isActive ? "📊 Generate Report" : "📄 Shift Report Ready"}
          </Text>
          <Text style={[styles.downloadText, { color: colors.muted }]}>
            {shift.isActive 
              ? "Download a report with all current data, photos, and trail map."
              : "This shift is complete. Download the full PDF report with all photos, timestamps, and location trail."
            }
          </Text>
          <TouchableOpacity 
            style={[styles.downloadButton, { backgroundColor: colors.primary }]}
            onPress={downloadReport}
          >
            <Text style={styles.downloadButtonText}>📥 Download PDF Report</Text>
          </TouchableOpacity>
        </View>

        {/* Auto-refresh indicator */}
        {shift.isActive && (
          <View style={styles.refreshIndicator}>
            <Text style={[styles.refreshText, { color: colors.muted }]}>
              🔄 Auto-refreshing every 5 seconds
            </Text>
            {lastUpdated && (
              <Text style={[styles.refreshTime, { color: colors.muted }]}>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </Text>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Photo Modal */}
      {selectedPhoto && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedPhoto(null)}>
                <Text style={[styles.modalClose, { color: colors.primary }]}>✕ Close</Text>
              </TouchableOpacity>
            </View>
            <Image source={{ uri: selectedPhoto.uri }} style={styles.modalImage} resizeMode="contain" />
            <View style={[styles.modalInfo, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTime, { color: colors.foreground }]}>
                📅 {new Date(selectedPhoto.timestamp).toLocaleString()}
              </Text>
              {selectedPhoto.address && (
                <Text style={[styles.modalAddress, { color: colors.muted }]}>
                  📍 {selectedPhoto.address}
                </Text>
              )}
              {selectedPhoto.location && (
                <Text style={[styles.modalCoords, { color: colors.muted }]}>
                  🌐 {selectedPhoto.location.latitude.toFixed(6)}, {selectedPhoto.location.longitude.toFixed(6)}
                </Text>
              )}
            </View>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { padding: 20 },
  loadingText: { marginTop: 16, fontSize: 16 },
  notFoundContainer: { alignItems: "center", gap: 16 },
  notFoundTitle: { fontSize: 24, fontWeight: "bold", textAlign: "center" },
  notFoundText: { fontSize: 16, textAlign: "center", lineHeight: 24 },
  codeBox: { padding: 16, borderRadius: 12, borderWidth: 1, marginTop: 8 },
  codeLabel: { fontSize: 12, marginBottom: 4 },
  codeValue: { fontSize: 20, fontWeight: "bold", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  header: { alignItems: "center", marginBottom: 24 },
  statusBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  statusText: { color: "#FFF", fontSize: 14, fontWeight: "bold" },
  elapsedTime: { fontSize: 48, fontWeight: "bold", marginTop: 16, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  siteName: { fontSize: 28, fontWeight: "bold", marginTop: 12, textAlign: "center" },
  staffName: { fontSize: 16, marginTop: 4 },
  pairCodeBadge: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginTop: 12 },
  pairCodeLabel: { fontSize: 12 },
  pairCodeValue: { fontSize: 16, fontWeight: "bold", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  cardTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  mapImage: { width: "100%", height: 200, borderRadius: 12 },
  mapLegend: { flexDirection: "row", justifyContent: "center", gap: 20, marginTop: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendLine: { width: 20, height: 4, borderRadius: 2 },
  legendText: { fontSize: 12 },
  mapButton: { padding: 14, borderRadius: 10, alignItems: "center", marginTop: 12 },
  mapButtonText: { color: "#FFF", fontSize: 15, fontWeight: "600" },
  locationAddress: { fontSize: 16, fontWeight: "500", marginBottom: 4 },
  locationCoords: { fontSize: 13, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", marginBottom: 4 },
  locationTime: { fontSize: 12, marginBottom: 12 },
  locationButton: { padding: 12, borderRadius: 10, alignItems: "center" },
  locationButtonText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statCard: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "bold" },
  statLabel: { fontSize: 12, marginTop: 4 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  detailLabel: { fontSize: 14, flex: 1 },
  detailValue: { fontSize: 14, fontWeight: "500", flex: 2, textAlign: "right" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoGridItem: { width: (SCREEN_WIDTH - 72) / 3, height: (SCREEN_WIDTH - 72) / 3, borderRadius: 8, overflow: "hidden" },
  photoGridImage: { width: "100%", height: "100%" },
  photoOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 4 },
  photoTime: { color: "#FFF", fontSize: 10, textAlign: "center" },
  photoHint: { fontSize: 12, textAlign: "center", marginTop: 8, fontStyle: "italic" },
  downloadCard: { padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  downloadTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  downloadText: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  downloadButton: { padding: 16, borderRadius: 12, alignItems: "center" },
  downloadButtonText: { color: "#FFF", fontSize: 16, fontWeight: "bold" },
  refreshIndicator: { alignItems: "center", paddingVertical: 12 },
  refreshText: { fontSize: 12 },
  refreshTime: { fontSize: 11, marginTop: 4 },
  // Modal styles
  modalOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "100%", height: "100%", paddingTop: 50 },
  modalHeader: { paddingHorizontal: 20, paddingBottom: 16 },
  modalClose: { fontSize: 16, fontWeight: "600" },
  modalImage: { flex: 1, width: "100%" },
  modalInfo: { padding: 20 },
  modalTime: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  modalAddress: { fontSize: 14, marginBottom: 4 },
  modalCoords: { fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
});
