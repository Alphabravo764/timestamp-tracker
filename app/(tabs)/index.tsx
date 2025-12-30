import { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface PhotoData {
  id: string;
  uri: string;
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
  } | null;
}

export default function CameraScreen() {
  const colors = useColors();
  const [facing, setFacing] = useState<CameraType>("back");
  const [permission, requestPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const cameraRef = useRef<CameraView>(null);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Request location permissions and start tracking
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setLocationPermission(true);
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation(location);
        
        // Update location every 10 seconds
        const locationInterval = setInterval(async () => {
          const loc = await Location.getCurrentPositionAsync({});
          setCurrentLocation(loc);
        }, 10000);
        
        return () => clearInterval(locationInterval);
      }
    })();
  }, []);

  if (!permission) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-foreground text-center">Loading camera...</Text>
      </ScreenContainer>
    );
  }

  if (!permission.granted) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-foreground text-center mb-4">
          Camera permission is required to take photos
        </Text>
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

  const formatTimestamp = () => {
    const date = currentTime.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const time = currentTime.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return `${date} ${time}`;
  };

  const formatLocation = () => {
    if (!currentLocation) return "Location unavailable";
    const { latitude, longitude } = currentLocation.coords;
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      if (!photo) return;

      // Save photo data
      const photoData: PhotoData = {
        id: Date.now().toString(),
        uri: photo.uri,
        timestamp: formatTimestamp(),
        location: currentLocation
          ? {
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
              accuracy: currentLocation.coords.accuracy,
            }
          : null,
      };

      // Load existing photos
      const existingPhotosJson = await AsyncStorage.getItem("photos");
      const existingPhotos: PhotoData[] = existingPhotosJson
        ? JSON.parse(existingPhotosJson)
        : [];

      // Add new photo
      existingPhotos.unshift(photoData);

      // Save back to storage
      await AsyncStorage.setItem("photos", JSON.stringify(existingPhotos));

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      Alert.alert("Photo Saved", "Your timestamped photo has been saved to the gallery");
    } catch (error) {
      console.error("Error taking picture:", error);
      Alert.alert("Error", "Failed to take picture. Please try again.");
    }
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing}>
        {/* Timestamp and Location Overlay */}
        <View style={styles.overlayContainer}>
          <View style={styles.infoBox}>
            <Text style={styles.timestampText}>{formatTimestamp()}</Text>
            <Text style={styles.locationText}>{formatLocation()}</Text>
          </View>
        </View>

        {/* Camera Controls */}
        <View style={styles.controlsContainer}>
          {/* Flip Camera Button */}
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: "rgba(0,0,0,0.5)" }]}
            onPress={toggleCameraFacing}
          >
            <Text style={styles.controlButtonText}>Flip</Text>
          </TouchableOpacity>

          {/* Capture Button */}
          <TouchableOpacity
            style={[styles.captureButton, { borderColor: colors.primary }]}
            onPress={takePicture}
          >
            <View style={[styles.captureButtonInner, { backgroundColor: colors.primary }]} />
          </TouchableOpacity>

          {/* Placeholder for symmetry */}
          <View style={styles.controlButton} />
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: "absolute",
    top: 60,
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
  locationText: {
    color: "#CCCCCC",
    fontSize: 14,
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
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  controlButtonText: {
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
});
