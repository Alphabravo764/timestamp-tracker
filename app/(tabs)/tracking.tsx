import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
  Platform,
  Alert,
  Switch,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface TrackingSession {
  id: string;
  startTime: string;
  isActive: boolean;
  locations: {
    latitude: number;
    longitude: number;
    timestamp: string;
  }[];
}

export default function TrackingScreen() {
  const colors = useColors();
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [session, setSession] = useState<TrackingSession | null>(null);
  const [locationCount, setLocationCount] = useState(0);

  useEffect(() => {
    loadSession();
    getCurrentLocation();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isTracking) {
      // Update location every 30 seconds when tracking
      interval = setInterval(async () => {
        await updateLocation();
      }, 30000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTracking]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation(location);
      }
    } catch (error) {
      console.error("Error getting location:", error);
    }
  };

  const loadSession = async () => {
    try {
      const sessionJson = await AsyncStorage.getItem("trackingSession");
      if (sessionJson) {
        const loadedSession: TrackingSession = JSON.parse(sessionJson);
        setSession(loadedSession);
        setIsTracking(loadedSession.isActive);
        setLocationCount(loadedSession.locations.length);
      }
    } catch (error) {
      console.error("Error loading session:", error);
    }
  };

  const updateLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location);

      if (session && isTracking) {
        const newLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: new Date().toISOString(),
        };

        const updatedSession = {
          ...session,
          locations: [...session.locations, newLocation],
        };

        await AsyncStorage.setItem("trackingSession", JSON.stringify(updatedSession));
        setSession(updatedSession);
        setLocationCount(updatedSession.locations.length);
      }
    } catch (error) {
      console.error("Error updating location:", error);
    }
  };

  const toggleTracking = async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    if (!isTracking) {
      // Start tracking
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Location permission is needed for live tracking.");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location);

      const newSession: TrackingSession = {
        id: Date.now().toString(),
        startTime: new Date().toISOString(),
        isActive: true,
        locations: [
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await AsyncStorage.setItem("trackingSession", JSON.stringify(newSession));
      setSession(newSession);
      setLocationCount(1);
      setIsTracking(true);

      Alert.alert("Tracking Started", "Your location is now being tracked. Share the link to let others see your live location.");
    } else {
      // Stop tracking
      if (session) {
        const updatedSession = { ...session, isActive: false };
        await AsyncStorage.setItem("trackingSession", JSON.stringify(updatedSession));
        setSession(updatedSession);
      }
      setIsTracking(false);

      Alert.alert("Tracking Stopped", "Location tracking has been stopped.");
    }
  };

  const shareLocation = async () => {
    if (!currentLocation) {
      Alert.alert("No Location", "Unable to get current location.");
      return;
    }

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const { latitude, longitude } = currentLocation.coords;
    const timestamp = new Date().toLocaleString();
    
    // Create a shareable message with coordinates
    const message = `📍 My Current Location\n\nLatitude: ${latitude.toFixed(6)}\nLongitude: ${longitude.toFixed(6)}\nTime: ${timestamp}\n\nView on map: https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=16`;

    try {
      await Share.share({
        message,
        title: "My Location",
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const formatCoordinate = (value: number | undefined, type: "lat" | "lng") => {
    if (value === undefined) return "---";
    const direction = type === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
    return `${Math.abs(value).toFixed(6)}° ${direction}`;
  };

  return (
    <ScreenContainer className="p-6">
      <View className="flex-1">
        {/* Header */}
        <Text className="text-3xl font-bold text-foreground mb-2">Live Tracking</Text>
        <Text className="text-muted mb-6">Share your real-time location with others</Text>

        {/* Current Location Card */}
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Current Location</Text>
          <View style={styles.coordinateRow}>
            <Text style={[styles.label, { color: colors.muted }]}>Latitude</Text>
            <Text style={[styles.value, { color: colors.foreground }]}>
              {formatCoordinate(currentLocation?.coords.latitude, "lat")}
            </Text>
          </View>
          <View style={styles.coordinateRow}>
            <Text style={[styles.label, { color: colors.muted }]}>Longitude</Text>
            <Text style={[styles.value, { color: colors.foreground }]}>
              {formatCoordinate(currentLocation?.coords.longitude, "lng")}
            </Text>
          </View>
          {currentLocation?.coords.accuracy && (
            <View style={styles.coordinateRow}>
              <Text style={[styles.label, { color: colors.muted }]}>Accuracy</Text>
              <Text style={[styles.value, { color: colors.foreground }]}>
                ±{currentLocation.coords.accuracy.toFixed(0)}m
              </Text>
            </View>
          )}
        </View>

        {/* Tracking Toggle */}
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.toggleRow}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                {isTracking ? "Tracking Active" : "Start Tracking"}
              </Text>
              <Text style={[styles.toggleSubtext, { color: colors.muted }]}>
                {isTracking
                  ? `${locationCount} location points recorded`
                  : "Enable to record your location history"}
              </Text>
            </View>
            <Switch
              value={isTracking}
              onValueChange={toggleTracking}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Share Button */}
        <TouchableOpacity
          style={[styles.shareButton, { backgroundColor: colors.primary }]}
          onPress={shareLocation}
        >
          <Text style={styles.shareButtonText}>Share Current Location</Text>
        </TouchableOpacity>

        {/* Refresh Button */}
        <TouchableOpacity
          style={[styles.refreshButton, { borderColor: colors.primary }]}
          onPress={getCurrentLocation}
        >
          <Text style={[styles.refreshButtonText, { color: colors.primary }]}>
            Refresh Location
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  coordinateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toggleSubtext: {
    fontSize: 13,
    marginTop: 4,
  },
  shareButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  shareButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  refreshButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
