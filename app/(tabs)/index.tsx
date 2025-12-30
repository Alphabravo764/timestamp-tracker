import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TextInput,
  ScrollView,
  Share,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import {
  getActiveShift,
  startShift,
  endShift,
  addLocationToShift,
  addPhotoToShift,
  formatDuration,
  getShiftDuration,
} from "@/lib/shift-storage";
import type { Shift, LocationPoint, ShiftPhoto } from "@/lib/shift-types";

type AppState = "idle" | "startForm" | "active" | "camera" | "confirmEnd";

export default function HomeScreen() {
  const colors = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [siteName, setSiteName] = useState("");
  const [staffName, setStaffName] = useState("");
  const [appState, setAppState] = useState<AppState>("idle");
  const [facing, setFacing] = useState<CameraType>("back");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load active shift on focus
  useFocusEffect(
    useCallback(() => {
      loadActiveShift();
      requestLocationPermission();
    }, [])
  );

  // Track location during active shift
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (activeShift?.isActive && appState === "active") {
      trackLocation(); // Track immediately
      interval = setInterval(() => trackLocation(), 30000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [activeShift?.isActive, appState]);

  const loadActiveShift = async () => {
    const shift = await getActiveShift();
    if (shift) {
      setActiveShift(shift);
      setAppState("active");
    } else {
      setAppState("idle");
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation(location);
      }
    } catch (e) {
      console.error("Location error:", e);
    }
  };

  const trackLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location);
      const point: LocationPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
        accuracy: location.coords.accuracy ?? undefined,
      };
      const updated = await addLocationToShift(point);
      if (updated) setActiveShift(updated);
    } catch (e) {
      console.error("Track error:", e);
    }
  };

  const handleStartShift = async () => {
    if (!siteName.trim()) {
      alert("Please enter the site name.");
      return;
    }
    
    setIsLoading(true);
    try {
      let location = currentLocation;
      if (!location) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          location = await Location.getCurrentPositionAsync({});
          setCurrentLocation(location);
        }
      }
      
      if (!location) {
        alert("Please enable location services.");
        setIsLoading(false);
        return;
      }

      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      const point: LocationPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
        accuracy: location.coords.accuracy ?? undefined,
      };

      const shift = await startShift(staffName || "Staff", siteName, point);
      setActiveShift(shift);
      setAppState("active");
      setSiteName("");
      setStaffName("");
    } catch (e) {
      console.error("Start shift error:", e);
      alert("Failed to start shift");
    }
    setIsLoading(false);
  };

  const handleEndShift = async () => {
    setIsLoading(true);
    try {
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      const completed = await endShift();
      setActiveShift(null);
      setAppState("idle");
      
      if (completed) {
        const duration = formatDuration(getShiftDuration(completed));
        alert(`Shift Completed!\n\nDuration: ${duration}\nPhotos: ${completed.photos.length}\nLocations: ${completed.locations.length}\n\nGo to History tab to view report.`);
      }
    } catch (e) {
      console.error("End shift error:", e);
      alert("Failed to end shift");
    }
    setIsLoading(false);
  };

  const copyPairCode = async () => {
    if (activeShift?.pairCode) {
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(activeShift.pairCode);
        }
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        console.error("Copy error:", e);
      }
    }
  };

  const sharePairCode = async () => {
    if (!activeShift) return;
    try {
      await Share.share({
        message: `Track my location!\n\nPair Code: ${activeShift.pairCode}\nSite: ${activeShift.siteName}\nStaff: ${activeShift.staffName}\n\nUse this code in the Timestamp Tracker app.`,
      });
    } catch (e) {
      console.error("Share error:", e);
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current || !activeShift) return;
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) return;

      const shiftPhoto: ShiftPhoto = {
        id: Date.now().toString(),
        uri: photo.uri,
        timestamp: new Date().toISOString(),
        location: currentLocation ? {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          timestamp: new Date().toISOString(),
          accuracy: currentLocation.coords.accuracy ?? undefined,
        } : null,
      };

      const updated = await addPhotoToShift(shiftPhoto);
      if (updated) setActiveShift(updated);
      
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      alert(`Photo #${updated?.photos.length || 1} saved!`);
    } catch (e) {
      console.error("Photo error:", e);
      alert("Failed to take photo");
    }
  };

  const formatTime = () => currentTime.toLocaleTimeString("en-US", { hour12: false });
  const formatDate = () => currentTime.toLocaleDateString();
  const formatCoords = () => {
    if (!currentLocation) return "Getting location...";
    return `${currentLocation.coords.latitude.toFixed(6)}, ${currentLocation.coords.longitude.toFixed(6)}`;
  };

  // ========== IDLE STATE ==========
  if (appState === "idle") {
    return (
      <ScreenContainer className="p-6">
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>Timestamp Camera</Text>
          <Text style={[styles.heroSubtitle, { color: colors.muted }]}>
            Start a shift to begin tracking
          </Text>

          <TouchableOpacity
            style={[styles.bigBtn, { backgroundColor: colors.primary }]}
            onPress={() => setAppState("startForm")}
          >
            <Text style={styles.bigBtnText}>Start Shift</Text>
          </TouchableOpacity>

          <Text style={[styles.hint, { color: colors.muted }]}>
            Location tracked every 30 seconds{"\n"}
            Photos include timestamp & GPS
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  // ========== START FORM ==========
  if (appState === "startForm") {
    return (
      <ScreenContainer className="p-6">
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, { color: colors.foreground }]}>Start New Shift</Text>
          
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.foreground }]}>Site Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Enter site name"
              placeholderTextColor={colors.muted}
              value={siteName}
              onChangeText={setSiteName}
              autoFocus
            />
            
            <Text style={[styles.label, { color: colors.foreground, marginTop: 16 }]}>Your Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="Optional"
              placeholderTextColor={colors.muted}
              value={staffName}
              onChangeText={setStaffName}
            />
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.foreground }]}>Current Location</Text>
            <Text style={[styles.coords, { color: colors.muted }]}>{formatCoords()}</Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 }]}
            onPress={handleStartShift}
            disabled={isLoading}
          >
            <Text style={styles.primaryBtnText}>{isLoading ? "Starting..." : "Start Shift"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
            onPress={() => setAppState("idle")}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.muted }]}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ========== CONFIRM END ==========
  if (appState === "confirmEnd") {
    return (
      <ScreenContainer className="p-6">
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>End Shift?</Text>
          <Text style={[styles.heroSubtitle, { color: colors.muted, marginBottom: 40 }]}>
            This will stop tracking and save your shift data.
          </Text>

          <TouchableOpacity
            style={[styles.dangerBtn, { backgroundColor: colors.error, marginBottom: 16, width: "100%" }]}
            onPress={handleEndShift}
            disabled={isLoading}
          >
            <Text style={styles.dangerBtnText}>{isLoading ? "Ending..." : "Yes, End Shift"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.border, width: "100%" }]}
            onPress={() => setAppState("active")}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.muted }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // ========== CAMERA VIEW ==========
  if (appState === "camera" && activeShift) {
    if (!permission?.granted) {
      return (
        <ScreenContainer className="items-center justify-center p-6">
          <Text style={{ color: colors.foreground, textAlign: "center", marginBottom: 16 }}>
            Camera permission required
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={requestPermission}
          >
            <Text style={styles.primaryBtnText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.border, marginTop: 12 }]}
            onPress={() => setAppState("active")}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.muted }]}>Back</Text>
          </TouchableOpacity>
        </ScreenContainer>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing}>
          <View style={styles.cameraTop}>
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: "rgba(0,0,0,0.6)" }]}
              onPress={() => setAppState("active")}
            >
              <Text style={{ color: "#FFF", fontWeight: "600" }}>← Back</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cameraInfo}>
            <View style={styles.infoBox}>
              <Text style={styles.infoTime}>{formatTime()}</Text>
              <Text style={styles.infoDate}>{formatDate()}</Text>
              <Text style={styles.infoCoords}>{formatCoords()}</Text>
            </View>
          </View>

          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={[styles.flipBtn, { backgroundColor: "rgba(255,255,255,0.3)" }]}
              onPress={() => setFacing(f => f === "back" ? "front" : "back")}
            >
              <Text style={{ color: "#FFF", fontSize: 12 }}>Flip</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
              <View style={styles.captureBtnInner} />
            </TouchableOpacity>

            <View style={{ width: 50 }} />
          </View>
        </CameraView>
      </View>
    );
  }

  // ========== ACTIVE SHIFT DASHBOARD ==========
  if (!activeShift) {
    return (
      <ScreenContainer className="p-6">
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ color: colors.muted }}>Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const duration = formatDuration(getShiftDuration(activeShift));

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.statusBadge, { backgroundColor: colors.success }]}>
            <Text style={styles.statusText}>● ACTIVE</Text>
          </View>
          <Text style={[styles.duration, { color: colors.foreground }]}>{duration}</Text>
        </View>

        {/* Site Info */}
        <Text style={[styles.siteName, { color: colors.foreground }]}>{activeShift.siteName}</Text>
        <Text style={[styles.staffNameText, { color: colors.muted }]}>{activeShift.staffName}</Text>

        {/* Pair Code Card */}
        <View style={[styles.pairCodeCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.pairCodeLabel}>PAIR CODE</Text>
          <TouchableOpacity onPress={copyPairCode}>
            <Text style={styles.pairCodeValue}>{activeShift.pairCode}</Text>
          </TouchableOpacity>
          <Text style={styles.pairCodeHint}>{copied ? "Copied!" : "Tap to copy"}</Text>
          
          <TouchableOpacity style={styles.shareBtn} onPress={sharePairCode}>
            <Text style={styles.shareBtnText}>Share Code</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{activeShift.photos.length}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Photos</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{activeShift.locations.length}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Locations</Text>
          </View>
        </View>

        {/* Current Location */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>Current Location</Text>
          <Text style={[styles.coords, { color: colors.muted }]}>{formatCoords()}</Text>
          <Text style={[styles.timestamp, { color: colors.muted }]}>{formatTime()} • {formatDate()}</Text>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => setAppState("camera")}
        >
          <Text style={styles.primaryBtnText}>📷 Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dangerBtn, { backgroundColor: colors.error }]}
          onPress={() => setAppState("confirmEnd")}
        >
          <Text style={styles.dangerBtnText}>End Shift</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 24 },
  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  input: { height: 48, borderRadius: 8, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  coords: { fontSize: 14, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  timestamp: { fontSize: 12, marginTop: 4 },
  primaryBtn: { padding: 16, borderRadius: 12, alignItems: "center", marginBottom: 12 },
  primaryBtnText: { color: "#FFF", fontSize: 18, fontWeight: "600" },
  secondaryBtn: { padding: 16, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  secondaryBtnText: { fontSize: 16 },
  dangerBtn: { padding: 16, borderRadius: 12, alignItems: "center", marginBottom: 12 },
  dangerBtnText: { color: "#FFF", fontSize: 18, fontWeight: "600" },
  heroTitle: { fontSize: 32, fontWeight: "bold", marginBottom: 8, textAlign: "center" },
  heroSubtitle: { fontSize: 16, marginBottom: 32, textAlign: "center" },
  bigBtn: { width: 180, height: 180, borderRadius: 90, justifyContent: "center", alignItems: "center" },
  bigBtnText: { color: "#FFF", fontSize: 22, fontWeight: "bold" },
  hint: { marginTop: 24, textAlign: "center", fontSize: 14, lineHeight: 22 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  statusText: { color: "#FFF", fontSize: 12, fontWeight: "bold" },
  duration: { fontSize: 18, fontWeight: "600" },
  siteName: { fontSize: 28, fontWeight: "bold", marginBottom: 4 },
  staffNameText: { fontSize: 16, marginBottom: 20 },
  pairCodeCard: { padding: 24, borderRadius: 16, alignItems: "center", marginBottom: 20 },
  pairCodeLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: "600", letterSpacing: 1 },
  pairCodeValue: { color: "#FFF", fontSize: 42, fontWeight: "bold", letterSpacing: 6, marginVertical: 8, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  pairCodeHint: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 16 },
  shareBtn: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 },
  shareBtnText: { color: "#FFF", fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statCard: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  statValue: { fontSize: 28, fontWeight: "bold" },
  statLabel: { fontSize: 12, marginTop: 4 },
  cameraTop: { position: "absolute", top: 50, left: 20, right: 20 },
  backBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignSelf: "flex-start" },
  cameraInfo: { position: "absolute", top: 100, left: 20, right: 20 },
  infoBox: { backgroundColor: "rgba(0,0,0,0.7)", padding: 12, borderRadius: 8 },
  infoTime: { color: "#FFF", fontSize: 24, fontWeight: "bold" },
  infoDate: { color: "#CCC", fontSize: 14, marginBottom: 4 },
  infoCoords: { color: "#AAA", fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  cameraControls: { position: "absolute", bottom: 50, left: 0, right: 0, flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingHorizontal: 50 },
  flipBtn: { width: 50, height: 50, borderRadius: 25, justifyContent: "center", alignItems: "center" },
  captureBtn: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: "#FFF", justifyContent: "center", alignItems: "center" },
  captureBtnInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FFF" },
});
