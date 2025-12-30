import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  TextInput,
  ScrollView,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
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

export default function HomeScreen() {
  const colors = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [siteName, setSiteName] = useState("");
  const [staffName, setStaffName] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");
  const cameraRef = useRef<CameraView>(null);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load active shift on mount
  useEffect(() => {
    loadActiveShift();
    requestLocationPermission();
  }, []);

  // Track location during active shift
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (activeShift?.isActive) {
      interval = setInterval(async () => {
        await trackLocation();
      }, 30000); // Every 30 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeShift?.isActive]);

  const loadActiveShift = async () => {
    const shift = await getActiveShift();
    setActiveShift(shift);
  };

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === "granted") {
      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location);
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
    } catch (error) {
      console.error("Error tracking location:", error);
    }
  };

  const handleStartShift = async () => {
    if (!siteName.trim()) {
      Alert.alert("Site Name Required", "Please enter the site name to start your shift.");
      return;
    }

    if (!currentLocation) {
      Alert.alert("Location Required", "Please enable location services to start your shift.");
      return;
    }

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const point: LocationPoint = {
      latitude: currentLocation.coords.latitude,
      longitude: currentLocation.coords.longitude,
      timestamp: new Date().toISOString(),
      accuracy: currentLocation.coords.accuracy ?? undefined,
    };

    const shift = await startShift(staffName || "Staff Member", siteName, point);
    setActiveShift(shift);
    setIsStarting(false);

    Alert.alert(
      "Shift Started",
      `Your pair code is: ${shift.pairCode}\n\nShare this code with watchers to let them track your location.`
    );
  };

  const handleEndShift = async () => {
    Alert.alert("End Shift", "Are you sure you want to end your shift?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End Shift",
        style: "destructive",
        onPress: async () => {
          if (Platform.OS !== "web") {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }

          const completedShift = await endShift();
          setActiveShift(null);

          if (completedShift) {
            const duration = formatDuration(getShiftDuration(completedShift));
            Alert.alert(
              "Shift Completed",
              `Duration: ${duration}\nPhotos: ${completedShift.photos.length}\nLocations: ${completedShift.locations.length}\n\nView your shift history to generate a report.`
            );
          }
        },
      },
    ]);
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
        location: currentLocation
          ? {
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
              timestamp: new Date().toISOString(),
              accuracy: currentLocation.coords.accuracy ?? undefined,
            }
          : null,
      };

      const updated = await addPhotoToShift(shiftPhoto);
      if (updated) setActiveShift(updated);

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert("Photo Saved", `Photo ${updated?.photos.length || 1} added to shift`);
    } catch (error) {
      console.error("Error taking picture:", error);
      Alert.alert("Error", "Failed to take picture");
    }
  };

  const formatTimestamp = () => {
    return currentTime.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const formatLocation = () => {
    if (!currentLocation) return "Location unavailable";
    const { latitude, longitude } = currentLocation.coords;
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  };

  // Start Shift Form
  if (isStarting) {
    return (
      <ScreenContainer className="p-6">
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text className="text-3xl font-bold text-foreground mb-2">Start Shift</Text>
          <Text className="text-muted mb-6">Enter details to begin your shift</Text>

          <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>Site Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g., Main Office Building"
              placeholderTextColor={colors.muted}
              value={siteName}
              onChangeText={setSiteName}
            />

            <Text style={[styles.inputLabel, { color: colors.foreground, marginTop: 16 }]}>Your Name (Optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g., John Smith"
              placeholderTextColor={colors.muted}
              value={staffName}
              onChangeText={setStaffName}
            />
          </View>

          <View style={[styles.locationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>Current Location</Text>
            <Text style={[styles.locationText, { color: colors.muted }]}>{formatLocation()}</Text>
          </View>

          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: colors.primary }]}
            onPress={handleStartShift}
          >
            <Text style={styles.startButtonText}>Start Shift</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: colors.border }]}
            onPress={() => setIsStarting(false)}
          >
            <Text style={[styles.cancelButtonText, { color: colors.muted }]}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // No Active Shift - Show Start Button
  if (!activeShift) {
    return (
      <ScreenContainer className="p-6">
        <View className="flex-1 justify-center items-center">
          <Text className="text-3xl font-bold text-foreground mb-2 text-center">Timestamp Camera</Text>
          <Text className="text-muted mb-8 text-center">Start a shift to begin tracking and taking photos</Text>

          <TouchableOpacity
            style={[styles.bigStartButton, { backgroundColor: colors.primary }]}
            onPress={() => setIsStarting(true)}
          >
            <Text style={styles.bigStartButtonText}>Start Shift</Text>
          </TouchableOpacity>

          <Text className="text-muted mt-6 text-center text-sm">
            Your location will be tracked during the shift.{"\n"}
            Photos will include timestamp and GPS coordinates.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  // Active Shift - Show Camera
  if (!permission?.granted) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-foreground text-center mb-4">Camera permission is required to take photos</Text>
        <TouchableOpacity
          onPress={requestPermission}
          style={{ backgroundColor: colors.primary }}
          className="px-6 py-3 rounded-full"
        >
          <Text className="text-background font-semibold">Grant Permission</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing}>
        {/* Shift Info Banner */}
        <View style={[styles.shiftBanner, { backgroundColor: colors.primary }]}>
          <Text style={styles.shiftBannerText}>
            {activeShift.siteName} • Code: {activeShift.pairCode}
          </Text>
        </View>

        {/* Timestamp and Location Overlay */}
        <View style={styles.overlayContainer}>
          <View style={styles.infoBox}>
            <Text style={styles.timestampText}>{formatTimestamp()}</Text>
            <Text style={styles.locationText}>{formatLocation()}</Text>
            <Text style={styles.statsText}>
              📍 {activeShift.locations.length} locations • 📷 {activeShift.photos.length} photos
            </Text>
          </View>
        </View>

        {/* Camera Controls */}
        <View style={styles.controlsContainer}>
          {/* End Shift Button */}
          <TouchableOpacity
            style={[styles.endShiftButton, { backgroundColor: colors.error }]}
            onPress={handleEndShift}
          >
            <Text style={styles.endShiftButtonText}>End</Text>
          </TouchableOpacity>

          {/* Capture Button */}
          <TouchableOpacity
            style={[styles.captureButton, { borderColor: "#FFFFFF" }]}
            onPress={takePicture}
          >
            <View style={[styles.captureButtonInner, { backgroundColor: "#FFFFFF" }]} />
          </TouchableOpacity>

          {/* Flip Camera */}
          <TouchableOpacity
            style={[styles.flipButton, { backgroundColor: "rgba(0,0,0,0.5)" }]}
            onPress={() => setFacing(facing === "back" ? "front" : "back")}
          >
            <Text style={styles.flipButtonText}>Flip</Text>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
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
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  locationCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  startButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  cancelButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
  },
  bigStartButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
  },
  bigStartButtonText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
  },
  shiftBanner: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  shiftBannerText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  overlayContainer: {
    position: "absolute",
    top: 110,
    left: 20,
    right: 20,
  },
  infoBox: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 12,
    borderRadius: 8,
  },
  timestampText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
  },
  statsText: {
    color: "#AAAAAA",
    fontSize: 12,
    marginTop: 4,
  },
  controlsContainer: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  endShiftButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  endShiftButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  flipButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  flipButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
