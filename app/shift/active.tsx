import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import * as Location from "expo-location";
import { CameraView, useCameraPermissions } from "expo-camera";

export default function ActiveShiftScreen() {
  const colors = useColors();
  const [elapsedTime, setElapsedTime] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const cameraRef = useRef<CameraView>(null);

  // Get active shift
  const { data: activeShift, isLoading, refetch } = trpc.shifts.getActive.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const addLocationMutation = trpc.locations.addBatch.useMutation();
  const endShiftMutation = trpc.shifts.end.useMutation();
  const uploadPhotoMutation = trpc.photos.upload.useMutation();

  // Calculate elapsed time
  useEffect(() => {
    if (!activeShift) {
      setElapsedTime("");
      return;
    }

    const updateElapsed = () => {
      const start = new Date(activeShift.startTimeUtc).getTime();
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
  }, [activeShift]);

  // Start location tracking
  useEffect(() => {
    if (!activeShift) return;

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;

        // Start watching location
        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 60000, // Update every minute
            distanceInterval: 50, // Or every 50 meters
          },
          (location) => {
            setCurrentLocation(location);
            // Send location to server
            if (activeShift) {
              addLocationMutation.mutate({
                shiftId: activeShift.id,
                points: [
                  {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    accuracy: location.coords.accuracy ?? undefined,
                    altitude: location.coords.altitude ?? undefined,
                    speed: location.coords.speed ?? undefined,
                    heading: location.coords.heading ?? undefined,
                    capturedAt: new Date(location.timestamp),
                    source: "gps",
                  },
                ],
              });
            }
          }
        );
      } catch (error) {
        console.error("Error starting location tracking:", error);
      }
    };

    startLocationTracking();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, [activeShift]);

  const handleTakePhoto = async () => {
    if (!cameraPermission) {
      return;
    }

    if (!cameraPermission.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Alert.alert(
          "Camera Permission Required",
          "Please enable camera permissions to take timestamp photos"
        );
        return;
      }
    }

    setShowCamera(true);
  };

  const handleCapturePhoto = async () => {
    if (!cameraRef.current || !activeShift) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      if (!photo || !photo.base64) {
        Alert.alert("Error", "Failed to capture photo");
        return;
      }

      // Upload photo with current location
      await uploadPhotoMutation.mutateAsync({
        shiftId: activeShift.id,
        photoData: photo.base64,
        contentType: "image/jpeg",
        latitude: currentLocation?.coords.latitude,
        longitude: currentLocation?.coords.longitude,
        accuracy: currentLocation?.coords.accuracy ?? undefined,
        photoType: "mid",
      });

      setShowCamera(false);
      Alert.alert("Success", "Photo captured and uploaded successfully");
    } catch (error: any) {
      console.error("Error capturing photo:", error);
      Alert.alert("Error", error.message || "Failed to upload photo");
    }
  };

  const handleShareLiveLink = async () => {
    if (!activeShift) return;

    const liveUrl = `${window.location.origin}/live/${activeShift.liveToken}`;

    try {
      await Share.share({
        message: `Track my shift live: ${liveUrl}`,
        url: liveUrl,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleShowPairCode = () => {
    if (!activeShift?.pairCode) return;

    Alert.alert(
      "Pair Code",
      `Share this code with your company:\n\n${activeShift.pairCode}\n\nThis code is only valid during your active shift.`,
      [
        {
          text: "Copy Code",
          onPress: () => {
            // In a real app, use Clipboard API
            Alert.alert("Copied", "Pair code copied to clipboard");
          },
        },
        { text: "Close" },
      ]
    );
  };

  const handleEndShift = () => {
    Alert.alert(
      "End Shift",
      "Are you sure you want to end your shift? You'll need to take a final photo.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Shift",
          style: "destructive",
          onPress: () => {
            // Navigate to end shift confirmation
            Alert.alert("Feature Coming Soon", "End shift with final photo will be implemented");
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!activeShift) {
    return (
      <ScreenContainer className="p-6 justify-center">
        <View className="items-center gap-4">
          <Text className="text-2xl font-bold text-foreground text-center">No Active Shift</Text>
          <Text className="text-base text-muted text-center">
            You don't have an active shift. Start a new shift to begin tracking.
          </Text>
          <TouchableOpacity
            className="bg-primary px-8 py-4 rounded-full mt-4"
            onPress={() => router.replace("/" as any)}
          >
            <Text className="text-white font-semibold text-lg">Go to Home</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  if (showCamera) {
    return (
      <View className="flex-1">
        <CameraView ref={cameraRef} className="flex-1" facing="back">
          <View className="flex-1 justify-end p-6 bg-black/20">
            <View className="items-center gap-4 mb-8">
              <TouchableOpacity
                className="bg-white w-20 h-20 rounded-full items-center justify-center"
                onPress={handleCapturePhoto}
              >
                <View className="bg-white w-16 h-16 rounded-full border-4 border-black" />
              </TouchableOpacity>

              <TouchableOpacity
                className="bg-black/50 px-6 py-3 rounded-full"
                onPress={() => setShowCamera(false)}
              >
                <Text className="text-white font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-6">
          {/* Header */}
          <View className="items-center gap-2">
            <View className="bg-success px-4 py-2 rounded-full">
              <Text className="text-white font-semibold">ON SHIFT</Text>
            </View>
            <Text className="text-4xl font-bold text-foreground mt-2">{elapsedTime}</Text>
            <Text className="text-lg font-semibold text-foreground">{activeShift.siteName}</Text>
          </View>

          {/* Action Cards */}
          <View className="gap-4">
            {/* Camera Card */}
            <TouchableOpacity
              className="bg-surface rounded-2xl p-6 border border-border"
              onPress={handleTakePhoto}
            >
              <Text className="text-xl font-semibold text-foreground mb-2">📸 Take Photo</Text>
              <Text className="text-muted">Capture a timestamp photo with location data</Text>
            </TouchableOpacity>

            {/* Share Card */}
            <View className="bg-surface rounded-2xl p-6 border border-border gap-3">
              <Text className="text-xl font-semibold text-foreground mb-2">🔗 Share</Text>

              <TouchableOpacity
                className="bg-primary px-4 py-3 rounded-xl"
                onPress={handleShareLiveLink}
              >
                <Text className="text-white font-semibold text-center">Share Live Link</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="bg-surface border border-border px-4 py-3 rounded-xl"
                onPress={handleShowPairCode}
              >
                <Text className="text-foreground font-semibold text-center">Show Pair Code</Text>
              </TouchableOpacity>
            </View>

            {/* Location Card */}
            <View className="bg-surface rounded-2xl p-6 border border-border">
              <Text className="text-xl font-semibold text-foreground mb-3">📍 Location</Text>
              {currentLocation ? (
                <View className="gap-1">
                  <Text className="text-muted text-sm">
                    Lat: {currentLocation.coords.latitude.toFixed(6)}
                  </Text>
                  <Text className="text-muted text-sm">
                    Lng: {currentLocation.coords.longitude.toFixed(6)}
                  </Text>
                  <Text className="text-muted text-sm">
                    Accuracy: ±{currentLocation.coords.accuracy?.toFixed(0)}m
                  </Text>
                </View>
              ) : (
                <Text className="text-muted">Acquiring location...</Text>
              )}
            </View>
          </View>

          {/* End Shift Button */}
          <TouchableOpacity
            className="bg-error px-6 py-4 rounded-full mt-auto"
            onPress={handleEndShift}
          >
            <Text className="text-white font-semibold text-center text-lg">End Shift</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
