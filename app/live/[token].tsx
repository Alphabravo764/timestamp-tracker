import { useState, useEffect, useCallback } from "react";
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
  Modal,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBaseUrl } from "@/constants/oauth";
import { generateStaticMapUrl } from "@/lib/google-maps";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Storage keys for local fallback
const ACTIVE_SHIFT_KEY = "@timestamp_camera_active_shift";
const SHIFT_HISTORY_KEY = "@timestamp_camera_shift_history";

interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: string;
  address?: string;
}

interface ShiftPhoto {
  id?: number;
  uri?: string;
  fileUrl?: string;
  timestamp: string;
  address?: string;
  location?: { latitude: number; longitude: number };
}

interface ShiftNote {
  id: string;
  text: string;
  timestamp: string;
}

interface ShiftData {
  id: string | number;
  staffName?: string;
  siteName: string;
  pairCode?: string;
  isActive?: boolean;
  status?: string;
  startTime?: string;
  startTimeUtc?: string;
  endTime?: string;
  endTimeUtc?: string;
  locations?: LocationPoint[];
  photos?: ShiftPhoto[];
  notes?: ShiftNote[];
}

export default function LiveViewerScreen() {
  const colors = useColors();
  const params = useLocalSearchParams();
  const token = params.token as string;

  const [shift, setShift] = useState<ShiftData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [elapsedTime, setElapsedTime] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<ShiftPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Try to load from server first, then fall back to local storage
  const loadShiftData = useCallback(async () => {
    try {
      setError(null);
      
      // First try sync API (in-memory live data)
      try {
        const syncResponse = await fetch(`${getApiBaseUrl()}/api/sync/shift/${token}`);
        if (syncResponse.ok) {
          const serverData = await syncResponse.json();
          if (serverData) {
            // Transform server data to our format
            const transformedShift: ShiftData = {
              id: serverData.id || serverData.shiftId,
              staffName: serverData.staffName,
              siteName: serverData.siteName,
              pairCode: serverData.pairCode,
              isActive: serverData.isActive,
              status: serverData.isActive ? "active" : "completed",
              startTime: serverData.startTime,
              startTimeUtc: serverData.startTime,
              endTime: serverData.endTime,
              endTimeUtc: serverData.endTime,
              locations: serverData.locations?.map((loc: any) => ({
                latitude: loc.latitude,
                longitude: loc.longitude,
                accuracy: loc.accuracy,
                timestamp: loc.timestamp,
                address: loc.address,
              })) || [],
              photos: serverData.photos?.map((photo: any) => ({
                id: photo.id,
                uri: photo.photoUri,
                fileUrl: photo.photoUri,
                timestamp: photo.timestamp,
                address: photo.address,
                location: photo.latitude && photo.longitude ? {
                  latitude: photo.latitude,
                  longitude: photo.longitude,
                } : undefined,
              })) || [],
              notes: serverData.notes?.map((note: any) => ({
                id: note.noteId,
                text: note.text,
                timestamp: note.timestamp,
              })) || [],
            };
            
            setShift(transformedShift);
            setLastUpdated(new Date());
            setIsLoading(false);
            return;
          }
        }
      } catch (serverError) {
        console.log("Server lookup failed, trying local storage:", serverError);
      }

      // Fall back to local storage
      const activeJson = await AsyncStorage.getItem(ACTIVE_SHIFT_KEY);
      if (activeJson) {
        const activeShift = JSON.parse(activeJson);
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
        const history = JSON.parse(historyJson);
        const found = history.find((s: any) => s.pairCode === token || s.id === token);
        if (found) {
          setShift(found);
          setLastUpdated(new Date());
          setIsLoading(false);
          return;
        }
      }

      // Not found anywhere
      setShift(null);
      setError("Shift not found. The pair code may be invalid or the shift has ended.");
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading shift:", error);
      setError("Failed to load shift data. Please try again.");
      setIsLoading(false);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    loadShiftData();
  }, [loadShiftData]);

  // Auto-refresh for active shifts
  useEffect(() => {
    const isActive = shift?.isActive || shift?.status === "active";
    if (!isActive) return;
    
    const interval = setInterval(() => {
      loadShiftData();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [shift?.isActive, shift?.status, loadShiftData]);

  // Calculate elapsed time
  useEffect(() => {
    const isActive = shift?.isActive || shift?.status === "active";
    if (!isActive) {
      setElapsedTime("");
      return;
    }

    const updateElapsed = () => {
      const startTime = shift?.startTime || shift?.startTimeUtc;
      if (!startTime) return;
      
      const start = new Date(startTime).getTime();
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
  }, [shift?.isActive, shift?.status, shift?.startTime, shift?.startTimeUtc]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadShiftData();
    setRefreshing(false);
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleTimeString([], { 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString([], {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const openTrailMap = () => {
    if (!shift?.locations || shift.locations.length === 0) return;
    
    const points = shift.locations;
    const start = points[0];
    const end = points[points.length - 1];
    
    // Open Google Maps with directions
    const url = `https://www.google.com/maps/dir/${start.latitude},${start.longitude}/${end.latitude},${end.longitude}`;
    Linking.openURL(url);
  };

  const getMapUrl = () => {
    if (!shift?.locations || shift.locations.length === 0) return null;
    
    const points = shift.locations.map(loc => ({
      latitude: loc.latitude,
      longitude: loc.longitude,
    }));
    
    return generateStaticMapUrl(points, 600, 300);
  };

  // Loading state
  if (isLoading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.muted }]}>
          Loading shift data...
        </Text>
      </ScreenContainer>
    );
  }

  // Error or not found state
  if (!shift || error) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center p-6">
        <View style={[styles.errorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.errorTitle, { color: colors.foreground }]}>
            Shift Not Found
          </Text>
          <Text style={[styles.errorText, { color: colors.muted }]}>
            {error || "This shift link is invalid or has expired.\nPlease check the pair code and try again."}
          </Text>
          <View style={[styles.codeBox, { backgroundColor: colors.background }]}>
            <Text style={[styles.codeLabel, { color: colors.muted }]}>Pair Code Entered:</Text>
            <Text style={[styles.codeValue, { color: colors.foreground }]}>{token}</Text>
          </View>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={loadShiftData}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const isActive = shift.isActive || shift.status === "active";
  const mapUrl = getMapUrl();
  const startTime = shift.startTime || shift.startTimeUtc;
  const endTime = shift.endTime || shift.endTimeUtc;

  return (
    <ScreenContainer>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.statusBadge, { backgroundColor: isActive ? colors.success : colors.muted }]}>
            <Text style={styles.statusText}>
              {isActive ? "🔴 LIVE" : "Completed"}
            </Text>
          </View>
          <Text style={[styles.siteName, { color: colors.foreground }]}>
            {shift.siteName}
          </Text>
          {shift.staffName && (
            <Text style={[styles.staffName, { color: colors.muted }]}>
              Staff: {shift.staffName}
            </Text>
          )}
        </View>

        {/* Time Info */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.timeRow}>
            <View style={styles.timeItem}>
              <Text style={[styles.timeLabel, { color: colors.muted }]}>Started</Text>
              <Text style={[styles.timeValue, { color: colors.foreground }]}>
                {formatTime(startTime)}
              </Text>
              <Text style={[styles.dateValue, { color: colors.muted }]}>
                {formatDate(startTime)}
              </Text>
            </View>
            {isActive ? (
              <View style={styles.timeItem}>
                <Text style={[styles.timeLabel, { color: colors.muted }]}>Duration</Text>
                <Text style={[styles.elapsedTime, { color: colors.primary }]}>
                  {elapsedTime || "00:00:00"}
                </Text>
              </View>
            ) : (
              <View style={styles.timeItem}>
                <Text style={[styles.timeLabel, { color: colors.muted }]}>Ended</Text>
                <Text style={[styles.timeValue, { color: colors.foreground }]}>
                  {formatTime(endTime)}
                </Text>
                <Text style={[styles.dateValue, { color: colors.muted }]}>
                  {formatDate(endTime)}
                </Text>
              </View>
            )}
          </View>
          {lastUpdated && (
            <Text style={[styles.lastUpdated, { color: colors.muted }]}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </Text>
          )}
        </View>

        {/* Map */}
        {mapUrl && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              📍 Location Trail
            </Text>
            <TouchableOpacity onPress={openTrailMap}>
              <Image
                source={{ uri: mapUrl }}
                style={styles.mapImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
            <Text style={[styles.mapHint, { color: colors.muted }]}>
              Tap map to open in Google Maps • {shift.locations?.length || 0} points recorded
            </Text>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {shift.locations?.length || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Locations</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {shift.photos?.length || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Photos</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {shift.notes?.length || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Notes</Text>
          </View>
        </View>

        {/* Notes */}
        {shift.notes && shift.notes.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              📝 Notes ({shift.notes.length})
            </Text>
            {shift.notes.map((note, index) => (
              <View key={note.id || index} style={[styles.noteItem, { borderBottomColor: colors.border }]}>
                <Text style={[styles.noteTime, { color: colors.muted }]}>
                  {formatTime(note.timestamp)}
                </Text>
                <Text style={[styles.noteText, { color: colors.foreground }]}>
                  {note.text}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Photos */}
        {shift.photos && shift.photos.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              📷 Photos ({shift.photos.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {shift.photos.map((photo, index) => (
                <TouchableOpacity
                  key={photo.id || index}
                  style={styles.photoThumb}
                  onPress={() => setSelectedPhoto(photo)}
                >
                  <Image
                    source={{ uri: photo.uri || photo.fileUrl }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                  <Text style={[styles.photoTime, { color: colors.muted }]}>
                    {formatTime(photo.timestamp)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={openTrailMap}
          >
            <Text style={styles.actionButtonText}>🗺️ Open Trail in Maps</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Photo Modal */}
      <Modal
        visible={!!selectedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setSelectedPhoto(null)}
          >
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
          {selectedPhoto && (
            <Image
              source={{ uri: selectedPhoto.uri || selectedPhoto.fileUrl }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}
          {selectedPhoto && (
            <View style={[styles.modalInfo, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalInfoText, { color: colors.foreground }]}>
                {formatTime(selectedPhoto.timestamp)} • {selectedPhoto.address || "Location unavailable"}
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    maxWidth: 400,
    width: "100%",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  codeBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: "100%",
  },
  codeLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  codeValue: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  statusText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  siteName: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  staffName: {
    fontSize: 16,
    marginTop: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  timeItem: {
    alignItems: "center",
  },
  timeLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: "600",
  },
  dateValue: {
    fontSize: 12,
    marginTop: 2,
  },
  elapsedTime: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  lastUpdated: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  mapImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
  },
  mapHint: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 8,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  noteItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  noteTime: {
    fontSize: 12,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
  },
  photoThumb: {
    marginRight: 12,
    alignItems: "center",
  },
  photoImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  photoTime: {
    fontSize: 10,
    marginTop: 4,
  },
  actions: {
    marginTop: 8,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  modalCloseText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "300",
  },
  modalImage: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH - 32,
    borderRadius: 8,
  },
  modalInfo: {
    position: "absolute",
    bottom: 50,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
  },
  modalInfoText: {
    fontSize: 14,
    textAlign: "center",
  },
});
