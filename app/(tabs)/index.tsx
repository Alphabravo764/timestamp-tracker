import { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  TextInput,
  ScrollView,
  Share,
  Image,
  Modal,
  Dimensions,
} from "react-native";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import {
  startShift,
  getActiveShift,
  endShift,
  addLocationToShift,
  addPhotoToShift,
  formatDuration,
  getShiftDuration,
} from "@/lib/shift-storage";
import type { Shift, LocationPoint, ShiftPhoto } from "@/lib/shift-types";
import { addNoteToShift, getShiftNotes } from "@/lib/shift-notes";
import { batchExportPhotos } from "@/lib/batch-export";
import { getTemplates, saveTemplate, useTemplate, type ShiftTemplate } from "@/lib/shift-templates";
import { generatePDFReport } from "@/lib/pdf-generator";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { syncShiftStart, syncLocation, syncPhoto, syncNote, syncShiftEnd } from "@/lib/server-sync";
import { PhotoWatermark, PhotoWatermarkRef } from "@/components/photo-watermark";

type AppState = "idle" | "startForm" | "active" | "camera" | "confirmEnd" | "gallery";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Reverse geocoding using Nominatim (free, no API key)
const getAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { "User-Agent": "TimestampCamera/1.0" } }
    );
    const data = await response.json();
    if (data.address) {
      const { road, house_number, postcode, city, town, village } = data.address;
      const street = house_number ? `${house_number} ${road}` : road;
      const area = city || town || village || "";
      const parts = [street, area, postcode].filter(Boolean);
      return parts.join(", ") || data.display_name?.split(",").slice(0, 3).join(",") || "Unknown location";
    }
    return "Unknown location";
  } catch (e) {
    console.error("Geocoding error:", e);
    return "Location unavailable";
  }
};

// Generate trail map URL using Google Maps
const getTrailMapUrl = (locations: LocationPoint[]): string => {
  if (locations.length === 0) return "";
  if (locations.length === 1) {
    const loc = locations[0];
    return `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
  }
  // For multiple points, create Google Maps directions URL to show the trail
  const start = locations[0];
  const end = locations[locations.length - 1];
  // Add waypoints for intermediate locations (max 10 for URL length)
  const waypoints = locations.slice(1, -1);
  const waypointStr = waypoints.length > 0 
    ? waypoints.slice(0, 10).map(l => `${l.latitude},${l.longitude}`).join("|")
    : "";
  
  let url = `https://www.google.com/maps/dir/${start.latitude},${start.longitude}/${end.latitude},${end.longitude}`;
  if (waypointStr) {
    url = `https://www.google.com/maps/dir/?api=1&origin=${start.latitude},${start.longitude}&destination=${end.latitude},${end.longitude}&waypoints=${waypointStr}`;
  }
  return url;
};

export default function HomeScreen() {
  const colors = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string>("Getting address...");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [siteName, setSiteName] = useState("");
  const [staffName, setStaffName] = useState("");
  const [appState, setAppState] = useState<AppState>("idle");
  const [facing, setFacing] = useState<CameraType>("back");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastPhoto, setLastPhoto] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<ShiftPhoto | null>(null);
  const [noteText, setNoteText] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const cameraRef = useRef<CameraView>(null);
  const watermarkRef = useRef<PhotoWatermarkRef>(null);

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
      loadTemplates();
    }, [])
  );

  const loadTemplates = async () => {
    const loaded = await getTemplates();
    setTemplates(loaded);
  };

  // Track location during active shift
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (activeShift?.isActive && appState === "active") {
      trackLocation();
      interval = setInterval(() => trackLocation(), 30000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [activeShift?.isActive, appState]);

  // Update address when location changes
  useEffect(() => {
    if (currentLocation) {
      getAddressFromCoords(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude
      ).then(setCurrentAddress);
    }
  }, [currentLocation?.coords.latitude, currentLocation?.coords.longitude]);

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
      // First check if we have location permission
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Location permission not granted, skipping tracking");
        return;
      }
      
      // Try to get location with timeout and accuracy settings
      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 0,
        });
      } catch (locError) {
        // If high accuracy fails, try with lower accuracy
        console.log("High accuracy location failed, trying lower accuracy");
        try {
          location = await Location.getLastKnownPositionAsync({});
        } catch (fallbackError) {
          console.log("Location unavailable, using cached location if available");
          if (currentLocation) {
            location = currentLocation;
          } else {
            console.log("No location available, skipping this tracking interval");
            return;
          }
        }
      }
      
      if (!location) {
        console.log("No location data available");
        return;
      }
      
      setCurrentLocation(location);
      
      // Get address for this location point
      const address = await getAddressFromCoords(
        location.coords.latitude,
        location.coords.longitude
      );
      
      const point: LocationPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
        accuracy: location.coords.accuracy ?? undefined,
        address: address,
      };
      const updated = await addLocationToShift(point);
      if (updated) {
        setActiveShift(updated);
        // Sync location to server
        try {
          await syncLocation({
            shiftId: updated.id,
            pairCode: updated.pairCode,
            latitude: point.latitude,
            longitude: point.longitude,
            accuracy: point.accuracy,
            address: point.address,
            timestamp: point.timestamp,
          });
        } catch (syncError) {
          console.log("Location sync error (non-blocking):", syncError);
        }
      }
    } catch (e) {
      // Silently handle errors - location tracking is best-effort
      console.log("Track location skipped:", e instanceof Error ? e.message : "Unknown error");
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

      // Get address for initial location
      const initialAddress = await getAddressFromCoords(
        location.coords.latitude,
        location.coords.longitude
      );

      const point: LocationPoint = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
        accuracy: location.coords.accuracy ?? undefined,
        address: initialAddress,
      };

      const shift = await startShift(staffName || "Staff", siteName, point);
      setActiveShift(shift);
      setAppState("active");
      
      // Sync to server for live viewing
      try {
        await syncShiftStart({
          id: shift.id,
          pairCode: shift.pairCode,
          staffName: shift.staffName,
          siteName: shift.siteName,
          startTime: shift.startTime,
          startLocation: {
            latitude: point.latitude,
            longitude: point.longitude,
            address: point.address,
          },
        });
      } catch (syncError) {
        console.log("Sync error (non-blocking):", syncError);
      }
      
      // Save as template for quick access
      if (siteName.trim()) {
        await saveTemplate(siteName.trim(), staffName.trim() || "Staff");
        loadTemplates();
      }
      
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
    const currentShift = activeShift; // Save reference before clearing
    try {
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      const completed = await endShift();
      setActiveShift(null);
      setAppState("idle");
      
      // Sync shift end to server
      if (currentShift) {
        try {
          await syncShiftEnd({
            shiftId: currentShift.id,
            pairCode: currentShift.pairCode,
            endTime: new Date().toISOString(),
            endLocation: currentLocation ? {
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
              address: currentAddress,
            } : undefined,
          });
        } catch (syncError) {
          console.log("End shift sync error (non-blocking):", syncError);
        }
      }
      
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
    
    // Generate live viewer URL
    // On web, use current origin (dev server URL)
    // On native, try to get the dev server URL from Metro bundler
    let baseUrl = "https://timestamp-tracker.app"; // Production fallback
    
    if (Platform.OS === "web" && typeof window !== "undefined") {
      baseUrl = window.location.origin;
    } else if (Platform.OS !== "web") {
      // For native, use the Metro bundler URL if available
      const metroUrl = Constants.expoConfig?.hostUri;
      if (metroUrl) {
        // Extract the base URL from Metro host (e.g., "8081-xxx.manus.computer")
        const [host] = metroUrl.split(':');
        baseUrl = `https://${host}`;
      }
    }
    
    const liveUrl = `${baseUrl}/live/${activeShift.pairCode}`;
    
    try {
      await Share.share({
        message: `📍 Live Location Tracking\n\nStaff: ${activeShift.staffName}\nSite: ${activeShift.siteName}\n\n🔗 View Live Location & Trail:\n${liveUrl}\n\nPair Code: ${activeShift.pairCode}\n\nCurrent Location:\n${currentAddress}`,
      });
    } catch (e) {
      console.error("Share error:", e);
    }
  };

  const addNote = async () => {
    if (!noteText.trim() || !activeShift) return;
    
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      const location = currentLocation ? {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        timestamp: new Date().toISOString(),
      } : undefined;
      
      const note = await addNoteToShift(noteText.trim(), location);
      if (note) {
        const updated = await getActiveShift();
        if (updated) {
          setActiveShift(updated);
          // Sync note to server
          try {
            await syncNote({
              shiftId: updated.id,
              pairCode: updated.pairCode,
              noteId: note.id,
              text: note.text,
              timestamp: note.timestamp,
            });
          } catch (syncError) {
            console.log("Note sync error (non-blocking):", syncError);
          }
        }
        setNoteText("");
        setShowNoteInput(false);
        alert("Note added!");
      }
    } catch (e) {
      console.error("Add note error:", e);
      alert("Failed to add note");
    }
  };

  const shareCurrentReport = async () => {
    if (!activeShift) return;
    
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      // Generate HTML report
      const html = await generatePDFReport(activeShift);
      
      if (Platform.OS === "web") {
        // On web, open HTML report in new tab
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      } else {
        // On mobile, generate PDF and share it
        try {
          // Generate PDF file from HTML
          const { uri } = await Print.printToFileAsync({
            html,
            base64: false,
          });
          
          // Check if sharing is available
          const isAvailable = await Sharing.isAvailableAsync();
          
          if (isAvailable) {
            await Sharing.shareAsync(uri, {
              mimeType: "application/pdf",
              dialogTitle: `Shift Report - ${activeShift.siteName}`,
              UTI: "com.adobe.pdf",
            });
          } else {
            alert("Sharing is not available on this device");
          }
        } catch (printError) {
          console.error("Print error:", printError);
          // Fallback to text sharing if PDF generation fails
          const duration = formatDuration(getShiftDuration(activeShift));
          const liveUrl = `https://timestamp-tracker.app/live/${activeShift.pairCode}`;
          
          const message = `📊 Shift Report - ${activeShift.siteName}\n\n` +
            `👤 Staff: ${activeShift.staffName}\n` +
            `⏱️ Duration: ${duration}\n` +
            `📷 Photos: ${activeShift.photos.length}\n` +
            `📍 Locations: ${activeShift.locations.length}\n` +
            `\n🔗 Live Tracking: ${liveUrl}`;
          
          await Share.share({ message, title: `Shift Report - ${activeShift.siteName}` });
        }
      }
    } catch (e) {
      console.error("Share report error:", e);
      alert("Failed to generate report");
    }
  };

  const sharePhoto = async (photo: ShiftPhoto) => {
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      // Photos are already watermarked when captured
      const photoUri = photo.uri;
      
      if (Platform.OS === "web") {
        const link = document.createElement("a");
        link.href = photoUri;
        link.download = `timestamp_photo_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        alert("Photo downloaded!");
      } else {
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
          alert("Sharing is not available on this device");
          return;
        }
        
        // expo-sharing requires file:// URLs
        let fileUri = photoUri;
        if (photoUri.startsWith("data:")) {
          const base64Data = photoUri.split(",")[1];
          const tempPath = `${FileSystem.cacheDirectory}timestamp_photo_${Date.now()}.jpg`;
          await FileSystem.writeAsStringAsync(tempPath, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          fileUri = tempPath;
        }
        
        await Sharing.shareAsync(fileUri, {
          mimeType: "image/jpeg",
          dialogTitle: "Share Timestamp Photo",
        });
      }
    } catch (e) {
      console.error("Share photo error:", e);
      alert("Failed to share photo");
    }
  };

  const takePicture = async () => {
    if (!cameraRef.current || !activeShift) {
      alert("Camera not ready");
      return;
    }
    
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      // Step 1: Take the photo with the camera
      const photo = await cameraRef.current.takePictureAsync({ 
        quality: 0.8,
        skipProcessing: true,
      });
      
      if (!photo || !photo.uri) {
        alert("Failed to capture photo. Please try again.");
        return;
      }
      
      console.log("[Camera] Photo taken:", photo.uri.substring(0, 50));
      
      // Get current location for the photo
      let photoLocation = currentLocation;
      try {
        photoLocation = await Location.getCurrentPositionAsync({});
        setCurrentLocation(photoLocation);
      } catch (e) {
        console.log("Using cached location for photo");
      }

      // Step 2: Add watermark to the photo using Skia (preferred) or fallback
      let finalUri = photo.uri;
      const watermarkData = {
        timestamp: formatTime(),
        date: formatDate(),
        address: currentAddress || "Location unavailable",
        latitude: photoLocation?.coords.latitude || 0,
        longitude: photoLocation?.coords.longitude || 0,
        staffName: activeShift.staffName,
        siteName: activeShift.siteName,
      };
      
      // Add watermark using PhotoWatermark component
      if (watermarkRef.current) {
        try {
          console.log("[Watermark] Adding watermark...");
          finalUri = await watermarkRef.current.addWatermark(photo.uri, watermarkData);
          console.log("[Watermark] Done:", finalUri?.substring(0, 50));
        } catch (wmError) {
          console.log("[Watermark] Error, using original:", wmError);
        }
      }
      
      // Step 3: Save to permanent file location on native
      if (Platform.OS !== "web" && finalUri.startsWith("file://")) {
        try {
          const fileName = `photo_${Date.now()}.jpg`;
          const destPath = `${FileSystem.documentDirectory}photos/${fileName}`;
          
          // Ensure photos directory exists
          const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}photos`);
          if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}photos`, { intermediates: true });
          }
          
          await FileSystem.copyAsync({ from: finalUri, to: destPath });
          finalUri = destPath;
          console.log("[Photo] Saved to:", finalUri);
        } catch (saveError) {
          console.log("[Photo] Could not save to documents:", saveError);
        }
      }

      const shiftPhoto: ShiftPhoto = {
        id: Date.now().toString(),
        uri: finalUri,
        timestamp: new Date().toISOString(),
        location: photoLocation ? {
          latitude: photoLocation.coords.latitude,
          longitude: photoLocation.coords.longitude,
          timestamp: new Date().toISOString(),
          accuracy: photoLocation.coords.accuracy ?? undefined,
        } : null,
        address: currentAddress,
      };

      const updated = await addPhotoToShift(shiftPhoto);
      if (updated) {
        setActiveShift(updated);
        setLastPhoto(finalUri);
        // Sync photo to server
        try {
          await syncPhoto({
            shiftId: updated.id,
            pairCode: updated.pairCode,
            photoUri: finalUri,
            latitude: photoLocation?.coords.latitude,
            longitude: photoLocation?.coords.longitude,
            address: currentAddress,
            timestamp: shiftPhoto.timestamp,
          });
        } catch (syncError) {
          console.log("Photo sync error (non-blocking):", syncError);
        }
      }
      
      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      alert(`✓ Photo #${updated?.photos.length || 1} saved!\n\n${currentAddress}`);
    } catch (e: any) {
      console.error("Photo error:", e);
      alert(`Camera error: ${e.message || "Unknown error"}. Try flipping the camera or restarting the app.`);
    }
  };

  const formatTime = () => currentTime.toLocaleTimeString("en-US", { hour12: false });
  const formatDate = () => currentTime.toLocaleDateString();

  // ========== PHOTO VIEWER MODAL ==========
  const PhotoViewerModal = () => {
    if (!selectedPhoto) return null;
    
    return (
      <Modal
        visible={!!selectedPhoto}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedPhoto(null)}>
                <Text style={[styles.modalClose, { color: colors.primary }]}>✕ Close</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => sharePhoto(selectedPhoto)}>
                <Text style={[styles.modalShare, { color: colors.primary }]}>📤 Share</Text>
              </TouchableOpacity>
            </View>
            
            {/* Photo */}
            <Image source={{ uri: selectedPhoto.uri }} style={styles.modalImage} resizeMode="contain" />
            
            {/* Info */}
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
      </Modal>
    );
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
  const selectTemplate = async (template: ShiftTemplate) => {
    setSiteName(template.siteName);
    setStaffName(template.staffName);
    await useTemplate(template.id);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  if (appState === "startForm") {
    return (
      <ScreenContainer className="p-6">
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, { color: colors.foreground }]}>Start New Shift</Text>
          
          {/* Quick Templates */}
          {templates.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.foreground }]}>⚡ Quick Start</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templatesScroll}>
                {templates.slice(0, 5).map((template) => (
                  <TouchableOpacity
                    key={template.id}
                    style={[styles.templateChip, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}
                    onPress={() => selectTemplate(template)}
                  >
                    <Text style={[styles.templateSite, { color: colors.primary }]}>{template.siteName}</Text>
                    <Text style={[styles.templateStaff, { color: colors.muted }]}>{template.staffName}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.foreground }]}>Site Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g., Main Office, Warehouse A"
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
            <Text style={[styles.address, { color: colors.foreground }]}>{currentAddress}</Text>
            {currentLocation && (
              <Text style={[styles.coords, { color: colors.muted }]}>
                {currentLocation.coords.latitude.toFixed(6)}, {currentLocation.coords.longitude.toFixed(6)}
              </Text>
            )}
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

  // ========== PHOTO GALLERY ==========
  if (appState === "gallery" && activeShift) {
    return (
      <ScreenContainer>
        <PhotoViewerModal />
        <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.galleryHeader}>
            <TouchableOpacity onPress={() => setAppState("active")}>
              <Text style={[styles.backText, { color: colors.primary }]}>← Back</Text>
            </TouchableOpacity>
            <Text style={[styles.galleryTitle, { color: colors.foreground }]}>
              Photos ({activeShift.photos.length})
            </Text>
            <View style={{ width: 50 }} />
          </View>

          {activeShift.photos.length === 0 ? (
            <View style={styles.emptyGallery}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                No photos yet.{"\n"}Take some photos during your shift!
              </Text>
            </View>
          ) : (
            <View style={styles.photoGrid}>
              {activeShift.photos.map((photo) => (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.photoGridItem}
                  onPress={() => setSelectedPhoto(photo)}
                >
                  <Image source={{ uri: photo.uri }} style={styles.photoGridImage} />
                  <View style={[styles.photoGridOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
                    <Text style={styles.photoGridTime}>
                      {new Date(photo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 20 }]}
            onPress={() => setAppState("camera")}
          >
            <Text style={styles.primaryBtnText}>📷 Take More Photos</Text>
          </TouchableOpacity>
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ========== CAMERA VIEW ==========
  if (appState === "camera" && activeShift) {
    if (!permission?.granted) {
      return (
        <ScreenContainer className="items-center justify-center p-6">
          <Text style={{ color: colors.foreground, textAlign: "center", marginBottom: 16, fontSize: 18 }}>
            Camera permission required
          </Text>
          <Text style={{ color: colors.muted, textAlign: "center", marginBottom: 24 }}>
            Please allow camera access to take timestamped photos
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
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {/* Hidden watermark component */}
        <PhotoWatermark ref={watermarkRef} />
        
        {/* Camera view */}
        <CameraView 
          ref={cameraRef} 
          style={StyleSheet.absoluteFill} 
          facing={facing}
          onCameraReady={() => console.log("Camera ready")}
        >
          {/* Live timestamp preview overlay (for reference only - not captured) */}
          <View style={styles.cameraInfo}>
            <View style={styles.infoBox}>
              <Text style={styles.infoTime}>{formatTime()}</Text>
              <Text style={styles.infoDate}>{formatDate()}</Text>
              <Text style={styles.infoAddress}>📍 {currentAddress}</Text>
              {currentLocation && (
                <Text style={styles.infoCoords}>
                  🌐 {currentLocation.coords.latitude.toFixed(6)}, {currentLocation.coords.longitude.toFixed(6)}
                </Text>
              )}
              {activeShift?.siteName && (
                <Text style={styles.infoSite}>🏢 {activeShift.siteName}</Text>
              )}
              {activeShift?.staffName && (
                <Text style={styles.infoStaff}>👤 {activeShift.staffName}</Text>
              )}
            </View>
          </View>
        </CameraView>

        {/* Top bar with back button - positioned safely below status bar */}
        <View style={{ position: "absolute", top: 60, left: 20, right: 20, zIndex: 10 }}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: "rgba(0,0,0,0.6)" }]}
            onPress={() => setAppState("active")}
          >
            <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
        </View>

        {/* Last photo preview */}
        {lastPhoto && (
          <View style={[styles.lastPhotoContainer, { position: "absolute" }]}>
            <Image source={{ uri: lastPhoto }} style={styles.lastPhotoThumb} />
          </View>
        )}

        {/* Camera controls */}
        <View style={[styles.cameraControls, { position: "absolute", bottom: 40, left: 0, right: 0 }]}>
          <TouchableOpacity
            style={[styles.flipBtn, { backgroundColor: "rgba(255,255,255,0.3)" }]}
            onPress={() => setFacing(f => f === "back" ? "front" : "back")}
          >
            <Text style={{ color: "#FFF", fontSize: 14 }}>🔄</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
            <View style={styles.captureBtnInner} />
          </TouchableOpacity>

          <View style={{ width: 50 }} />
        </View>
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
      <PhotoViewerModal />
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
          <Text style={styles.pairCodeHint}>{copied ? "✓ Copied!" : "Tap to copy"}</Text>
          
          <TouchableOpacity style={styles.shareBtn} onPress={sharePairCode}>
            <Text style={styles.shareBtnText}>📤 Share Location & Code</Text>
          </TouchableOpacity>
        </View>

        {/* Current Location */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>📍 Current Location</Text>
          <Text style={[styles.address, { color: colors.foreground }]}>{currentAddress}</Text>
          {currentLocation && (
            <Text style={[styles.coords, { color: colors.muted }]}>
              {currentLocation.coords.latitude.toFixed(6)}, {currentLocation.coords.longitude.toFixed(6)}
            </Text>
          )}
          <Text style={[styles.timestamp, { color: colors.muted }]}>{formatTime()} • {formatDate()}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <TouchableOpacity 
            style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => activeShift.photos.length > 0 && setAppState("gallery")}
          >
            <Text style={[styles.statValue, { color: colors.foreground }]}>{activeShift.photos.length}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Photos</Text>
            {activeShift.photos.length > 0 && (
              <Text style={[styles.statHint, { color: colors.primary }]}>Tap to view</Text>
            )}
          </TouchableOpacity>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{activeShift.locations.length}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Locations</Text>
          </View>
        </View>

        {/* Notes Section */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.photoHeaderRow}>
            <Text style={[styles.label, { color: colors.foreground }]}>📝 Notes ({(activeShift.notes || []).length})</Text>
            <TouchableOpacity onPress={() => setShowNoteInput(!showNoteInput)}>
              <Text style={[styles.viewAllText, { color: colors.primary }]}>{showNoteInput ? "Cancel" : "+ Add Note"}</Text>
            </TouchableOpacity>
          </View>
          
          {showNoteInput && (
            <View style={styles.noteInputContainer}>
              <TextInput
                style={[styles.noteInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Enter note..."
                placeholderTextColor={colors.muted}
                value={noteText}
                onChangeText={setNoteText}
                multiline
                numberOfLines={3}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.addNoteBtn, { backgroundColor: colors.primary, opacity: noteText.trim() ? 1 : 0.5 }]}
                onPress={addNote}
                disabled={!noteText.trim()}
              >
                <Text style={styles.addNoteBtnText}>Add Note</Text>
              </TouchableOpacity>
            </View>
          )}
          
          {(activeShift.notes || []).length > 0 && (
            <View style={styles.notesList}>
              {(activeShift.notes || []).slice(-3).reverse().map((note) => (
                <View key={note.id} style={[styles.noteItem, { borderColor: colors.border }]}>
                  <Text style={[styles.noteTime, { color: colors.muted }]}>
                    {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  <Text style={[styles.noteText, { color: colors.foreground }]}>{note.text}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Photo Thumbnails */}
        {activeShift.photos.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.photoHeaderRow}>
              <Text style={[styles.label, { color: colors.foreground }]}>📷 Recent Photos</Text>
              <TouchableOpacity onPress={() => setAppState("gallery")}>
                <Text style={[styles.viewAllText, { color: colors.primary }]}>View All →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
              {activeShift.photos.slice(-5).reverse().map((photo) => (
                <TouchableOpacity 
                  key={photo.id} 
                  style={styles.photoThumbContainer}
                  onPress={() => setSelectedPhoto(photo)}
                >
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                  <Text style={[styles.photoThumbTime, { color: colors.muted }]}>
                    {new Date(photo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Action Buttons */}
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => setAppState("camera")}
        >
          <Text style={styles.primaryBtnText}>📷 Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.primary }]}
          onPress={shareCurrentReport}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>📋 Share Report</Text>
        </TouchableOpacity>

        {activeShift.photos.length > 0 && (
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
            onPress={() => setAppState("gallery")}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.muted }]}>🖼️ View All Photos</Text>
          </TouchableOpacity>
        )}

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
  address: { fontSize: 16, fontWeight: "500", marginBottom: 4 },
  coords: { fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  timestamp: { fontSize: 12, marginTop: 8 },
  primaryBtn: { padding: 16, borderRadius: 12, alignItems: "center", marginBottom: 12 },
  primaryBtnText: { color: "#FFF", fontSize: 18, fontWeight: "600" },
  secondaryBtn: { padding: 16, borderRadius: 12, alignItems: "center", borderWidth: 1, marginBottom: 12 },
  secondaryBtnText: { fontSize: 16, fontWeight: "500" },
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
  shareBtn: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 },
  shareBtnText: { color: "#FFF", fontWeight: "600", fontSize: 15 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statCard: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  statValue: { fontSize: 28, fontWeight: "bold" },
  statLabel: { fontSize: 12, marginTop: 4 },
  statHint: { fontSize: 11, marginTop: 4 },
  cameraTop: { position: "absolute", top: 50, left: 20, right: 20, zIndex: 10 },
  backBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignSelf: "flex-start" },
  cameraInfo: { position: "absolute", top: 100, left: 20, right: 20, zIndex: 10 },
  infoBox: { backgroundColor: "rgba(0,0,0,0.7)", padding: 12, borderRadius: 8 },
  infoTime: { color: "#FFF", fontSize: 28, fontWeight: "bold" },
  infoDate: { color: "#CCC", fontSize: 14, marginBottom: 8 },
  infoAddress: { color: "#FFF", fontSize: 14, fontWeight: "500", marginBottom: 4 },
  infoCoords: { color: "#AAA", fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  infoSite: { color: "#CCC", fontSize: 12, marginTop: 4 },
  infoStaff: { color: "#CCC", fontSize: 12 },
  lastPhotoContainer: { position: "absolute", bottom: 140, left: 20, zIndex: 10 },
  lastPhotoThumb: { width: 60, height: 60, borderRadius: 8, borderWidth: 2, borderColor: "#FFF" },
  cameraControls: { position: "absolute", bottom: 50, left: 0, right: 0, flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingHorizontal: 50, zIndex: 10 },
  flipBtn: { width: 50, height: 50, borderRadius: 25, justifyContent: "center", alignItems: "center" },
  captureBtn: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: "#FFF", justifyContent: "center", alignItems: "center" },
  captureBtnInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#FFF" },
  // Gallery styles
  galleryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  galleryTitle: { fontSize: 20, fontWeight: "bold" },
  backText: { fontSize: 16, fontWeight: "600" },
  emptyGallery: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyText: { textAlign: "center", fontSize: 16, lineHeight: 24 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoGridItem: { width: (SCREEN_WIDTH - 56) / 3, height: (SCREEN_WIDTH - 56) / 3, borderRadius: 8, overflow: "hidden" },
  photoGridImage: { width: "100%", height: "100%" },
  photoGridOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 4 },
  photoGridTime: { color: "#FFF", fontSize: 10, textAlign: "center" },
  // Photo thumbnails in dashboard
  photoHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  viewAllText: { fontSize: 14, fontWeight: "500" },
  photoScroll: { marginTop: 8 },
  photoThumbContainer: { marginRight: 12, alignItems: "center" },
  photoThumb: { width: 70, height: 70, borderRadius: 8 },
  photoThumbTime: { fontSize: 10, marginTop: 4 },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "100%", height: "100%", paddingTop: 50 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16 },
  modalClose: { fontSize: 16, fontWeight: "600" },
  modalShare: { fontSize: 16, fontWeight: "600" },
  modalImage: { flex: 1, width: "100%" },
  modalInfo: { padding: 20 },
  modalTime: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  modalAddress: { fontSize: 14, marginBottom: 4 },
  modalCoords: { fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  // Note styles
  noteInputContainer: { marginTop: 8 },
  noteInput: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: "top" },
  addNoteBtn: { marginTop: 8, padding: 12, borderRadius: 8, alignItems: "center" },
  addNoteBtnText: { color: "#FFF", fontWeight: "600", fontSize: 14 },
  notesList: { marginTop: 12 },
  noteItem: { borderTopWidth: 1, paddingTop: 8, marginTop: 8 },
  noteTime: { fontSize: 11, marginBottom: 2 },
  noteText: { fontSize: 14, lineHeight: 20 },
  // Template styles
  templatesScroll: { marginTop: 8 },
  templateChip: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginRight: 10, minWidth: 120 },
  templateSite: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  templateStaff: { fontSize: 12 },
});
