import { useState, useRef, useCallback, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { getActiveShift, addPhotoToShift, type Shift } from "@/lib/shift-storage";
import { ScreenErrorBoundary } from "@/components/ScreenErrorBoundary";

function ActiveShiftScreenContent() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);

  // State
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Load shift on focus
  useFocusEffect(
    useCallback(() => {
      loadShift();
    }, [])
  );

  const loadShift = async () => {
    try {
      setIsLoading(true);
      const shift = await getActiveShift();
      setActiveShift(shift);
    } catch (error) {
      console.error("Error loading shift:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Camera permission
  const handleCameraPress = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert("Camera Permission", "Camera access is required to take photos.");
        return;
      }
    }
    setShowCamera(true);
  };

  // Photo capture - MINIMAL version
  const capturePhoto = async () => {
    if (!cameraRef.current || processing) return;
    setProcessing(true);

    try {
      console.log("[PHOTO] Starting capture...");
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) throw new Error("No photo captured");

      console.log("[PHOTO] Photo taken, saving locally...");

      // Get location
      let lat = 0, lng = 0;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      } catch (e) {
        console.log("[PHOTO] Location failed, using 0,0");
      }

      // Save to shift
      const timestamp = new Date().toISOString();
      const updatedShift = await addPhotoToShift({
        id: `photo_${Date.now()}`,
        uri: photo.uri,
        localUri: photo.uri,
        timestamp,
        ts: Date.now(),
        location: { latitude: lat, longitude: lng, timestamp, accuracy: 0 },
        address: "Test address",
      });

      console.log("[PHOTO] Saved, photoCount:", updatedShift?.photos?.length);

      // Update state DIRECTLY
      if (updatedShift) {
        setActiveShift(updatedShift);
      }

      // Close camera with delay
      setTimeout(() => {
        console.log("[PHOTO] Closing camera");
        setShowCamera(false);
      }, 100);

    } catch (error) {
      console.error("[PHOTO] Error:", error);
      Alert.alert("Error", "Failed to capture photo");
    } finally {
      setProcessing(false);
    }
  };

  // Debug log every render
  console.log("[RENDER] isLoading:", isLoading, "showCamera:", showCamera, "photoCount:", activeShift?.photos?.length);

  // Loading state
  if (isLoading) {
    console.log("[RENDER] → LOADING");
    return (
      <View style={[styles.center, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Loading...</Text>
      </View>
    );
  }

  // No shift
  if (!activeShift) {
    console.log("[RENDER] → NO SHIFT");
    return (
      <View style={[styles.center, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>No active shift</Text>
        <TouchableOpacity onPress={() => router.replace("/")}>
          <Text style={{ color: colors.primary, marginTop: 16 }}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Camera view
  if (showCamera) {
    console.log("[RENDER] → CAMERA");
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 10 }]}
          onPress={() => setShowCamera(false)}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.captureBtn, { bottom: insets.bottom + 30 }]}
          onPress={capturePhoto}
          disabled={processing}
        >
          {processing ? (
            <Text style={{ color: "#000" }}>...</Text>
          ) : (
            <View style={styles.captureBtnInner} />
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // MAIN UI - Minimal version
  console.log("[RENDER] → MAIN UI");
  const photos = activeShift.photos || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Active Shift (MINIMAL TEST)</Text>
        <Text style={{ color: colors.muted }}>Photos: {photos.length}</Text>
      </View>

      {/* Photo List */}
      <ScrollView style={styles.content}>
        {photos.length === 0 ? (
          <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 40 }}>
            No photos yet. Tap camera button to add.
          </Text>
        ) : (
          photos.map((photo: any, idx: number) => (
            <View key={photo.id || idx} style={styles.photoItem}>
              <Image source={{ uri: photo.uri || photo.localUri }} style={styles.thumbnail} />
              <Text style={{ color: colors.text }}>Photo {idx + 1}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Camera FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={handleCameraPress}
      >
        <Ionicons name="camera" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export default function ActiveShiftScreen() {
  return (
    <ScreenErrorBoundary>
      <ActiveShiftScreenContent />
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title: { fontSize: 20, fontWeight: '700' },
  content: { flex: 1, padding: 16 },
  photoItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  thumbnail: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#e5e7eb' },
  fab: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#4f46e5', justifyContent: 'center', alignItems: 'center' },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  closeBtn: { position: 'absolute', right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  captureBtn: { position: 'absolute', alignSelf: 'center', width: 70, height: 70, borderRadius: 35, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  captureBtnInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff', borderWidth: 3, borderColor: '#000' },
});
