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
  ScrollView,
  Clipboard,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface TrackingSession {
  id: string;
  staffName: string;
  pairCode: string;
  startTime: string;
  isActive: boolean;
  locations: {
    latitude: number;
    longitude: number;
    timestamp: string;
  }[];
}

// Generate 6-digit pair code
const generatePairCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export default function TrackingScreen() {
  const colors = useColors();
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [session, setSession] = useState<TrackingSession | null>(null);
  const [locationCount, setLocationCount] = useState(0);
  const [staffName, setStaffName] = useState("Staff Member");

  useEffect(() => {
    loadSession();
    getCurrentLocation();
    loadStaffName();
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
  }, [isTracking, session]);

  const loadStaffName = async () => {
    try {
      const name = await AsyncStorage.getItem("staffName");
      if (name) setStaffName(name);
    } catch (error) {
      console.error("Error loading staff name:", error);
    }
  };

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

      const pairCode = generatePairCode();
      const newSession: TrackingSession = {
        id: Date.now().toString(),
        staffName: staffName,
        pairCode: pairCode,
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

      Alert.alert(
        "Tracking Started",
        `Your pair code is: ${pairCode}\n\nShare this code with watchers so they can track your location.`
      );
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

  const copyPairCode = async () => {
    if (!session?.pairCode) return;
    
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    Clipboard.setString(session.pairCode);
    Alert.alert("Copied!", "Pair code copied to clipboard");
  };

  const shareLiveLink = async () => {
    if (!session || !currentLocation) {
      Alert.alert("No Active Session", "Start tracking first to share your live location.");
      return;
    }

    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const { latitude, longitude } = currentLocation.coords;
    const timestamp = new Date().toLocaleString();
    
    // Get the base URL for our viewer
    const baseUrl = Platform.OS === "web" 
      ? window.location.origin 
      : "https://8081-i4k0orawdmfzlz97qze7e-c1ad53ca.us2.manus.computer";
    const viewerUrl = `${baseUrl}/viewer/${session.pairCode}`;
    
    // Create shareable message with our own viewer link
    const message = `📍 Live Location Tracking

Staff: ${session.staffName}
Pair Code: ${session.pairCode}
Started: ${new Date(session.startTime).toLocaleString()}

🔗 View Live Location & Trail:
${viewerUrl}

Current Location:
Lat: ${latitude.toFixed(6)}
Lng: ${longitude.toFixed(6)}
Updated: ${timestamp}

The link shows real-time location with trail map and has a Download Report button.`;

    try {
      await Share.share({
        message,
        title: "Live Location Tracking",
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

  const formatDuration = () => {
    if (!session?.startTime) return "0:00";
    const start = new Date(session.startTime).getTime();
    const now = Date.now();
    const diff = Math.floor((now - start) / 1000);
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    return `${hours}:${minutes.toString().padStart(2, "0")}`;
  };

  return (
    <ScreenContainer>
      <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text className="text-3xl font-bold text-foreground mb-2">Live Tracking</Text>
        <Text className="text-muted mb-6">Share your real-time location with watchers</Text>

        {/* Pair Code Card (shown when tracking) */}
        {isTracking && session && (
          <View
            style={[styles.pairCodeCard, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.pairCodeLabel}>Your Pair Code</Text>
            <TouchableOpacity onPress={copyPairCode}>
              <Text style={styles.pairCodeValue}>{session.pairCode}</Text>
            </TouchableOpacity>
            <Text style={styles.pairCodeHint}>Tap to copy • Share with watchers</Text>
          </View>
        )}

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

        {/* Tracking Status Card */}
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.foreground, marginBottom: 4 }]}>
                {isTracking ? "Tracking Active" : "Start Tracking"}
              </Text>
              <Text style={[styles.toggleSubtext, { color: colors.muted }]}>
                {isTracking
                  ? `${locationCount} points • Duration: ${formatDuration()}`
                  : "Enable to start recording your location"}
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

        {/* Share Live Link Button */}
        <TouchableOpacity
          style={[
            styles.shareButton,
            { backgroundColor: isTracking ? colors.primary : colors.muted },
          ]}
          onPress={shareLiveLink}
          disabled={!isTracking}
        >
          <Text style={styles.shareButtonText}>Share Live Location Link</Text>
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

        {/* Session Info */}
        {session && (
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.foreground }]}>Session Info</Text>
            <Text style={[styles.infoText, { color: colors.muted }]}>
              Started: {new Date(session.startTime).toLocaleString()}
            </Text>
            <Text style={[styles.infoText, { color: colors.muted }]}>
              Status: {session.isActive ? "Active" : "Ended"}
            </Text>
            <Text style={[styles.infoText, { color: colors.muted }]}>
              Total Points: {session.locations.length}
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pairCodeCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  pairCodeLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    marginBottom: 8,
  },
  pairCodeValue: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "bold",
    letterSpacing: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  pairCodeHint: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginTop: 8,
  },
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
    marginBottom: 16,
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    marginBottom: 4,
  },
});
