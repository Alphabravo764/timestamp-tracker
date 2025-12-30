import { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";

export default function EndShiftScreen() {
  const colors = useColors();
  const params = useLocalSearchParams();
  const shiftId = Number(params.shiftId);

  const [showCamera, setShowCamera] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const { data: shift, isLoading } = trpc.shifts.getById.useQuery({ shiftId });
  const endShiftMutation = trpc.shifts.end.useMutation();
  const uploadPhotoMutation = trpc.photos.upload.useMutation();

  // Get current location
  useEffect(() => {
    const getCurrentLocation = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          setCurrentLocation(location);
        }
      } catch (error) {
        console.error("Error getting location:", error);
      }
    };

    getCurrentLocation();
  }, []);

  const handleTakeFinalPhoto = async () => {
    if (!cameraPermission) {
      return;
    }

    if (!cameraPermission.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Alert.alert(
          "Camera Permission Required",
          "Camera access is required to take the final shift photo"
        );
        return;
      }
    }

    setShowCamera(true);
  };

  const handleCapturePhoto = async () => {
    if (!cameraRef.current || !shift) return;

    setUploading(true);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      if (!photo || !photo.base64) {
        Alert.alert("Error", "Failed to capture photo");
        setUploading(false);
        return;
      }

      // Upload final photo
      const photoResult = await uploadPhotoMutation.mutateAsync({
        shiftId: shift.id,
        photoData: photo.base64,
        contentType: "image/jpeg",
        latitude: currentLocation?.coords.latitude,
        longitude: currentLocation?.coords.longitude,
        accuracy: currentLocation?.coords.accuracy ?? undefined,
        photoType: "end",
      });

      // End the shift
      await endShiftMutation.mutateAsync({
        shiftId: shift.id,
        finalPhotoUrl: photoResult.photoUrl,
        latitude: currentLocation?.coords.latitude,
        longitude: currentLocation?.coords.longitude,
        accuracy: currentLocation?.coords.accuracy ?? undefined,
      });

      setShowCamera(false);
      setUploading(false);

      // Navigate to completion screen
      Alert.alert("Shift Ended", "Your shift has been completed successfully", [
        {
          text: "View Summary",
          onPress: () => router.replace(`/shift/complete?shiftId=${shift.id}` as any),
        },
      ]);
    } catch (error: any) {
      console.error("Error ending shift:", error);
      Alert.alert("Error", error.message || "Failed to end shift");
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!shift) {
    return (
      <ScreenContainer className="p-6 justify-center">
        <View className="items-center gap-4">
          <Text className="text-2xl font-bold text-foreground text-center">Shift Not Found</Text>
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
          <View className="flex-1 bg-black/30">
            {/* Timestamp Overlay */}
            <View className="p-6 bg-black/50">
              <Text className="text-white text-lg font-bold">Final Shift Photo</Text>
              <Text className="text-white text-sm mt-1">
                {new Date().toLocaleString()}
              </Text>
              {currentLocation && (
                <Text className="text-white text-xs mt-1">
                  {currentLocation.coords.latitude.toFixed(6)}, {currentLocation.coords.longitude.toFixed(6)}
                </Text>
              )}
            </View>

            {/* Capture Controls */}
            <View className="flex-1 justify-end p-6">
              <View className="items-center gap-4 mb-8">
                <TouchableOpacity
                  className="bg-white w-20 h-20 rounded-full items-center justify-center"
                  onPress={handleCapturePhoto}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <View className="bg-white w-16 h-16 rounded-full border-4 border-black" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  className="bg-black/50 px-6 py-3 rounded-full"
                  onPress={() => setShowCamera(false)}
                  disabled={uploading}
                >
                  <Text className="text-white font-semibold">Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <View className="flex-1 justify-center gap-6">
        {/* Warning Icon */}
        <View className="items-center">
          <View className="w-24 h-24 rounded-full bg-warning/20 items-center justify-center mb-4">
            <Text className="text-6xl">⚠️</Text>
          </View>
          <Text className="text-3xl font-bold text-foreground text-center">End Your Shift</Text>
        </View>

        {/* Shift Info */}
        <View className="bg-surface rounded-2xl p-6 border border-border">
          <View className="gap-3">
            <View>
              <Text className="text-sm text-muted">Site</Text>
              <Text className="text-lg font-semibold text-foreground">{shift.siteName}</Text>
            </View>
            <View>
              <Text className="text-sm text-muted">Started</Text>
              <Text className="text-base text-foreground">
                {new Date(shift.startTimeUtc).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View className="bg-warning/10 rounded-xl p-4 border border-warning/20">
          <Text className="text-base text-foreground">
            <Text className="font-semibold">Final photo required:</Text> You must take a timestamp
            photo to complete your shift. This photo will be included in your shift report.
          </Text>
        </View>

        {/* Buttons */}
        <View className="gap-3">
          <TouchableOpacity
            className="bg-error px-6 py-4 rounded-full"
            onPress={handleTakeFinalPhoto}
          >
            <Text className="text-white font-semibold text-center text-lg">
              Take Final Photo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="px-6 py-4 rounded-full"
            onPress={() => router.back()}
          >
            <Text className="text-muted font-semibold text-center text-lg">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}
