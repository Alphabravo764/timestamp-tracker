import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  Platform,
  Linking,
  ScrollView,
  Image,
  Modal,
  Dimensions,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import {
  getShiftHistory,
  deleteShift,
  formatDuration,
  getShiftDuration,
} from "@/lib/shift-storage";
import type { Shift, LocationPoint, ShiftPhoto } from "@/lib/shift-types";
import { generatePDFReport } from "@/lib/pdf-generator";
import { generateStaticMapUrlEncoded } from "@/lib/google-maps";
import { savePhotoToLibrary } from "@/lib/photo-export";
import { Ionicons } from "@expo/vector-icons";
import { batchExportPhotos } from "@/lib/batch-export";
import { formatWatermarkTimestamp } from "@/lib/watermark";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { PhotoWatermark, type PhotoWatermarkRef } from "@/components/photo-watermark";

// SCREEN_HEIGHT needed for positioning watermark offscreen
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

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

// Reverse geocoding using Nominatim
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
      return parts.join(", ") || "Unknown location";
    }
    return "Unknown location";
  } catch (e) {
    return "Location unavailable";
  }
};

// Calculate distance in km
const getShiftDistance = (locations: any[]) => {
  if (!locations || locations.length < 2) return "0.00 km";
  let totalDist = 0;
  for (let i = 0; i < locations.length - 1; i++) {
    const lat1 = locations[i].latitude;
    const lon1 = locations[i].longitude;
    const lat2 = locations[i + 1].latitude;
    const lon2 = locations[i + 1].longitude;

    // Haversine formula
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    totalDist += R * c;
  }
  return totalDist.toFixed(2) + " km";
};

export default function HistoryScreen() {
  const colors = useColors();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<ShiftPhoto | null>(null);
  const [startAddress, setStartAddress] = useState<string>("");
  const [endAddress, setEndAddress] = useState<string>("");
  /* Opacity must be non-zero for captureRef to work on some native views, but 0 usually works for view-shot. 
     0.01 is safer to ensure it's "visible" to the rendering engine. 
     Position absolute with zIndex -1 hides it from user interaction/view. */
  const watermarkStyle = { position: 'absolute' as const, opacity: 0.01, zIndex: -1, top: SCREEN_HEIGHT };
  const watermarkRef = useRef<PhotoWatermarkRef>(null);

  useFocusEffect(
    useCallback(() => {
      loadShifts();
    }, [])
  );

  const loadShifts = async () => {
    const history = await getShiftHistory();
    setShifts(history);
  };

  const loadAddresses = async (shift: Shift) => {
    if (shift.locations.length > 0) {
      const first = shift.locations[0];
      const last = shift.locations[shift.locations.length - 1];

      const startAddr = first.address || await getAddressFromCoords(first.latitude, first.longitude);
      const endAddr = last.address || await getAddressFromCoords(last.latitude, last.longitude);

      setStartAddress(startAddr);
      setEndAddress(endAddr);
    }
  };

  const handleSelectShift = async (shift: Shift) => {
    setSelectedShift(shift);
    setStartAddress("Loading...");
    setEndAddress("Loading...");
    await loadAddresses(shift);
  };

  const handleDeleteShift = (shiftId: string) => {
    if (Platform.OS === "web") {
      if (confirm("Are you sure you want to delete this shift record?")) {
        deleteShift(shiftId).then(() => {
          loadShifts();
          setSelectedShift(null);
        });
      }
    } else {
      Alert.alert("Delete Shift", "Are you sure you want to delete this shift record?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteShift(shiftId);
            await loadShifts();
            setSelectedShift(null);
          },
        },
      ]);
    }
  };

  const viewTrailOnMap = (shift: Shift) => {
    if (shift.locations.length === 0) {
      alert("No location data for this shift.");
      return;
    }
    const url = getTrailMapUrl(shift.locations);
    Linking.openURL(url);
  };

  const viewPDFReport = async (shift: Shift) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const html = await generatePDFReport(shift);

      if (Platform.OS === "web") {
        // On web, open HTML report in new tab
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      } else {
        // On mobile, generate and share PDF
        try {
          const { uri } = await Print.printToFileAsync({
            html,
            base64: false,
          });

          const isAvailable = await Sharing.isAvailableAsync();

          if (isAvailable) {
            await Sharing.shareAsync(uri, {
              mimeType: "application/pdf",
              dialogTitle: `Shift Report - ${shift.siteName}`,
              UTI: "com.adobe.pdf",
            });
          } else {
            alert("Sharing is not available on this device");
          }
        } catch (printError) {
          console.error("Print error:", printError);
          alert("Failed to generate PDF. Please try again.");
        }
      }
    } catch (error) {
      console.error("PDF error:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  const sharePhoto = async (photo: ShiftPhoto) => {
    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      if (!watermarkRef.current) {
        Alert.alert("Error", "Watermark engine not ready");
        return;
      }

      // Generate watermarked version using client-side component (Offline supported)
      const watermarkedUri = await watermarkRef.current.addWatermark(photo.uri, {
        timestamp: formatWatermarkTimestamp(new Date(photo.timestamp)),
        address: photo.address || "Location unavailable",
        latitude: photo.location?.latitude || 0,
        longitude: photo.location?.longitude || 0,
        staffName: selectedShift?.staffName,
        siteName: selectedShift?.siteName,
        date: new Date(photo.timestamp).toLocaleDateString("en-GB")
      });

      if (Platform.OS === "web") {
        // On web, download watermarked image
        const link = document.createElement("a");
        link.href = watermarkedUri;
        link.download = `timestamp_photo_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        alert("Watermarked photo downloaded!");
      } else {
        // On mobile, save to temp file then share
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
          alert("Sharing is not available on this device");
          return;
        }

        // The captured ref usually returns a file URI on native, so direct share works
        // But if it returns base64 (less likely with captureRef default), we handle it.
        // PhotoWatermark uses captureRef with 'tmpfile' result, so it should be a URI.

        await Sharing.shareAsync(watermarkedUri, {
          mimeType: "image/jpeg",
          dialogTitle: "Share Timestamp Photo",
        });
      }
    } catch (e) {
      console.error("Share photo error:", e);
      alert("Failed to share photo. Please try again.");
    }
  };

  /* Removed exportPhotoWithWatermark as it was duplicate logic, relying on share instead or simplify */
  // ... keeping simplified export logic if needed, but share is primary.
  // Actually, let's update exportPhotoWithWatermark too for consistency if buttons use it.
  const exportPhotoWithWatermark = async (photo: ShiftPhoto) => {
    await sharePhoto(photo);
  };
  /*
  if (!selectedShift) return;

  try {
    // Re-use logic
    sharePhoto(photo);
  } catch (error) {
     // ...
  }
};
*/


  const exportAllPhotos = async () => {
    if (!selectedShift || selectedShift.photos.length === 0) return;

    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      alert(`Exporting ${selectedShift.photos.length} photos...`);

      const result = await batchExportPhotos(
        selectedShift.photos,
        selectedShift.staffName,
        selectedShift.siteName
      );

      alert(result.message);
    } catch (error) {
      console.error("Batch export error:", error);
      alert("Error exporting photos. Please try again.");
    }
  };

  const generateTextReport = async (shift: Shift) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const duration = formatDuration(getShiftDuration(shift));
    const startDate = new Date(shift.startTime).toLocaleString();
    const endDate = shift.endTime ? new Date(shift.endTime).toLocaleString() : "In Progress";

    let report = `📋 SHIFT REPORT\n`;
    report += `═══════════════════════════\n\n`;
    report += `📍 Site: ${shift.siteName}\n`;
    report += `👤 Staff: ${shift.staffName}\n`;
    report += `🔑 Pair Code: ${shift.pairCode}\n\n`;
    report += `⏰ TIMING\n`;
    report += `───────────────────────────\n`;
    report += `Start: ${startDate}\n`;
    report += `End: ${endDate}\n`;
    report += `Duration: ${duration}\n\n`;
    report += `📊 STATISTICS\n`;
    report += `───────────────────────────\n`;
    report += `Location Points: ${shift.locations.length}\n`;
    report += `Photos Taken: ${shift.photos.length}\n\n`;

    if (shift.locations.length > 0) {
      report += `🗺️ LOCATION TRAIL\n`;
      report += `───────────────────────────\n`;

      const first = shift.locations[0];
      const last = shift.locations[shift.locations.length - 1];

      report += `START LOCATION:\n`;
      report += `  📍 ${startAddress || `${first.latitude.toFixed(6)}, ${first.longitude.toFixed(6)}`}\n`;
      report += `  🕐 ${new Date(first.timestamp).toLocaleTimeString()}\n\n`;

      report += `END LOCATION:\n`;
      report += `  📍 ${endAddress || `${last.latitude.toFixed(6)}, ${last.longitude.toFixed(6)}`}\n`;
      report += `  🕐 ${new Date(last.timestamp).toLocaleTimeString()}\n\n`;

      report += `VIEW TRAIL MAP:\n`;
      report += `${getTrailMapUrl(shift.locations)}\n\n`;
    }

    if (shift.photos.length > 0) {
      report += `📷 PHOTOS\n`;
      report += `───────────────────────────\n`;
      shift.photos.forEach((photo, index) => {
        report += `${index + 1}. ${new Date(photo.timestamp).toLocaleString()}\n`;
        if (photo.address) {
          report += `   📍 ${photo.address}\n`;
        } else if (photo.location) {
          report += `   📍 ${photo.location.latitude.toFixed(6)}, ${photo.location.longitude.toFixed(6)}\n`;
        }
      });
    }

    report += `\n═══════════════════════════\n`;
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += `Timestamp Camera App\n`;

    try {
      await Share.share({
        message: report,
        title: `Shift Report - ${shift.siteName}`,
      });
    } catch (error) {
      console.error("Error sharing report:", error);
    }
  };

  // Photo Viewer Modal - with watermark overlay
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
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setSelectedPhoto(null)}>
                <Text style={[styles.modalClose, { color: colors.primary }]}>✕ Close</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => sharePhoto(selectedPhoto)}>
                <Text style={[styles.modalAction, { color: colors.primary }]}>📤 Share</Text>
              </TouchableOpacity>
            </View>

            {/* Photo with watermark overlay */}
            <View style={{ flex: 1, position: 'relative' }}>
              <Image source={{ uri: selectedPhoto.uri }} style={styles.modalImage} resizeMode="contain" />

              {/* Watermark overlay */}
              <View style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                paddingVertical: 12,
                paddingHorizontal: 16,
                backgroundColor: 'rgba(0,0,0,0.7)'
              }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 4 }}>
                  {formatWatermarkTimestamp(new Date(selectedPhoto.timestamp))}
                </Text>
                {selectedPhoto.address && (
                  <Text style={{ color: '#e2e8f0', fontSize: 12, marginBottom: 2 }}>
                    📍 {selectedPhoto.address}
                  </Text>
                )}
                {selectedPhoto.location && (
                  <Text style={{ color: '#94a3b8', fontSize: 10 }}>
                    🌐 {selectedPhoto.location.latitude.toFixed(6)}, {selectedPhoto.location.longitude.toFixed(6)}
                  </Text>
                )}
              </View>
            </View>

            <View style={[styles.modalInfo, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTime, { color: colors.muted, fontSize: 11 }]}>
                📷 Photo will be shared with watermark burned in
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  // Shift Detail View - Modern Design
  if (selectedShift) {
    const duration = formatDuration(getShiftDuration(selectedShift));
    const mapUrl = generateStaticMapUrlEncoded(selectedShift.locations, 600, 300);
    const startDate = new Date(selectedShift.startTime);
    const endDate = selectedShift.endTime ? new Date(selectedShift.endTime) : null;

    // Build timeline events
    const timelineEvents: Array<{
      type: 'start' | 'end' | 'photo' | 'note';
      time: string;
      title: string;
      subtitle?: string;
      photo?: any;
      note?: any;
    }> = [];

    // Add shift start
    timelineEvents.push({
      type: 'start',
      time: startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      title: 'Shift Started',
      subtitle: selectedShift.staffName || 'Officer on duty'
    });

    // Add photos
    selectedShift.photos.forEach(photo => {
      timelineEvents.push({
        type: 'photo',
        time: new Date(photo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: 'Photo Evidence',
        subtitle: photo.address || 'Location recorded',
        photo
      });
    });

    // Add notes
    if (selectedShift.notes) {
      selectedShift.notes.forEach(note => {
        timelineEvents.push({
          type: 'note',
          time: new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          title: 'Note Added',
          subtitle: note.text,
          note
        });
      });
    }

    // Add shift end
    if (endDate) {
      timelineEvents.push({
        type: 'end',
        time: endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        title: 'Shift Ended',
        subtitle: 'Manual clock-out'
      });
    }

    // Sort by time (newest first for display)
    timelineEvents.sort((a, b) => {
      const timeA = new Date(`2000-01-01 ${a.time}`).getTime();
      const timeB = new Date(`2000-01-01 ${b.time}`).getTime();
      return timeB - timeA;
    });

    return (
      <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <PhotoViewerModal />

        {/* Map Hero Section */}
        <View style={{ height: 280, backgroundColor: '#e2e8f0', position: 'relative' }}>
          {/* Header Controls */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 50, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
            <TouchableOpacity
              onPress={() => setSelectedShift(null)}
              style={{ width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="chevron-back" size={24} color="#334155" />
            </TouchableOpacity>

            <View style={{ backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155', textTransform: 'uppercase' }}>
                {startDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} • #{selectedShift.pairCode}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => generateTextReport(selectedShift)}
              style={{ width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="share-social-outline" size={20} color="#334155" />
            </TouchableOpacity>
          </View>

          {/* Map Image */}
          {mapUrl ? (
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => viewTrailOnMap(selectedShift)}
              activeOpacity={0.9}
            >
              <Image source={{ uri: mapUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' }}>
              <Ionicons name="map-outline" size={48} color="#94a3b8" />
              <Text style={{ color: '#94a3b8', marginTop: 8, fontSize: 12 }}>No location data</Text>
            </View>
          )}

          {/* Map Overlay Card */}
          <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }}>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', padding: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 }}>Patrol Area</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1e293b' }}>{selectedShift.siteName}</Text>
              </View>
              <View style={{ width: 40, height: 40, backgroundColor: '#eff6ff', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="location" size={20} color="#3b82f6" />
              </View>
            </View>
          </View>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={{ flex: 1, marginTop: -16, backgroundColor: '#f8fafc', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
          contentContainerStyle={{ padding: 20, paddingTop: 28 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats Grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
            {/* Duration */}
            <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="time-outline" size={20} color="#f97316" />
              </View>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#1e293b' }}>{duration}</Text>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Duration</Text>
              </View>
            </View>

            {/* Photos */}
            <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3e8ff', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="camera-outline" size={20} color="#a855f7" />
              </View>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#1e293b' }}>{selectedShift.photos.length}</Text>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Photos</Text>
              </View>
            </View>

            {/* Locations */}
            <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="navigate-outline" size={20} color="#3b82f6" />
              </View>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#1e293b' }}>{selectedShift.locations.length}</Text>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Points</Text>
              </View>
            </View>

            {/* Notes */}
            <View style={{ flex: 1, minWidth: '45%', backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="document-text-outline" size={20} color="#f59e0b" />
              </View>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#1e293b' }}>{selectedShift.notes?.length || 0}</Text>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>Notes</Text>
              </View>
            </View>
          </View>

          {/* Timeline Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b', textTransform: 'uppercase', letterSpacing: 0.5 }}>Shift Timeline</Text>
          </View>

          {/* Timeline */}
          <View style={{ borderLeftWidth: 2, borderLeftColor: '#e2e8f0', marginLeft: 8, paddingLeft: 20 }}>
            {timelineEvents.map((event, index) => (
              <View key={index} style={{ position: 'relative', marginBottom: 24 }}>
                {/* Dot */}
                <View style={{
                  position: 'absolute',
                  left: -28,
                  top: 4,
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: '#fff',
                  borderWidth: 4,
                  borderColor: event.type === 'start' ? '#22c55e' : event.type === 'end' ? '#ef4444' : event.type === 'photo' ? '#a855f7' : '#f59e0b'
                }} />

                {/* Content */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#1e293b' }}>{event.title}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#94a3b8' }}>{event.time}</Text>
                </View>

                {event.subtitle && (
                  <Text style={{ fontSize: 12, color: '#64748b', lineHeight: 18 }} numberOfLines={2}>{event.subtitle}</Text>
                )}

                {/* Photo thumbnail */}
                {event.photo && (
                  <TouchableOpacity
                    style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}
                    onPress={() => setSelectedPhoto(event.photo)}
                  >
                    <Image
                      source={{ uri: event.photo.uri }}
                      style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: '#e2e8f0' }}
                    />
                    <View style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: 8, flex: 1, justifyContent: 'center' }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155' }}>Photo Evidence</Text>
                      <Text style={{ fontSize: 10, color: '#94a3b8' }}>Tap to view</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Note content */}
                {event.note && (
                  <View style={{ marginTop: 8, backgroundColor: '#fef9c3', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#fef08a' }}>
                    <Text style={{ fontSize: 12, color: '#713f12', lineHeight: 18 }}>{event.note.text}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Export PDF Button */}
          <View style={{ marginTop: 16, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
            <TouchableOpacity
              style={{ backgroundColor: '#1e293b', paddingVertical: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onPress={() => viewPDFReport(selectedShift)}
            >
              <Ionicons name="document-text" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Download PDF Report</Text>
            </TouchableOpacity>
          </View>

          {/* Secondary Actions */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity
              style={{ flex: 1, backgroundColor: '#fff', paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}
              onPress={() => viewTrailOnMap(selectedShift)}
            >
              <Ionicons name="map-outline" size={18} color="#3b82f6" />
              <Text style={{ color: '#3b82f6', fontSize: 11, fontWeight: '600', marginTop: 4 }}>View Map</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flex: 1, backgroundColor: '#fff', paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}
              onPress={() => generateTextReport(selectedShift)}
            >
              <Ionicons name="share-social-outline" size={18} color="#22c55e" />
              <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '600', marginTop: 4 }}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ flex: 1, backgroundColor: '#fff', paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#fecaca', alignItems: 'center' }}
              onPress={() => handleDeleteShift(selectedShift.id)}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '600', marginTop: 4 }}>Delete</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // Shift List - Modern Card Design
  const renderShiftItem = ({ item }: { item: Shift }) => {
    const duration = formatDuration(getShiftDuration(item));
    const distance = getShiftDistance(item.locations); // Requires helper
    const isActive = item.isActive;
    const startDate = new Date(item.startTime);
    const endTime = item.endTime ? new Date(item.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Present';
    const timeRange = `${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endTime}`;

    // Relative date label
    const today = new Date();
    const isToday = startDate.toDateString() === today.toDateString();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = startDate.toDateString() === yesterday.toDateString();
    const dateLabel = isToday ? 'Today' : isYesterday ? 'Yesterday' : startDate.toLocaleDateString([], { weekday: 'short' });
    const fullDate = startDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

    return (
      <TouchableOpacity
        style={[styles.modernCard, { backgroundColor: colors.surface, borderColor: isActive ? colors.primary : colors.border, borderWidth: isActive ? 2 : 1 }]}
        onPress={() => handleSelectShift(item)}
        activeOpacity={0.8}
      >
        {/* Status Indicator Bar */}
        <View style={[styles.statusBar, { backgroundColor: isActive ? '#22c55e' : '#3b82f6', width: 6 }]} />

        <View style={styles.modernCardContent}>
          {/* Top Row: Date & Status Badge */}
          <View style={styles.modernCardHeader}>
            <View>
              <Text style={[styles.modernDateLabel, { color: colors.muted, fontSize: 13 }]}>{dateLabel}</Text>
              <Text style={[styles.modernFullDate, { color: colors.text, fontSize: 16 }]}>{fullDate}</Text>
            </View>
            <View style={[styles.statusBadge, isActive ? styles.statusBadgeActive : { backgroundColor: '#dcfce7', borderColor: '#bbf7d0', borderWidth: 1 }]}>
              <Text style={[styles.statusBadgeText, { color: isActive ? '#16a34a' : '#15803d', fontSize: 13, fontWeight: '700' }]}>
                {isActive ? '● Live' : '✓ Completed'}
              </Text>
            </View>
          </View>

          {/* Middle: Location & Time */}
          <View style={styles.locationRow}>
            <View style={[styles.locationIcon, { backgroundColor: '#eff6ff' }]}>
              <Text style={{ fontSize: 16 }}>📍</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.siteName, { color: colors.text, fontSize: 19, fontWeight: '700' }]} numberOfLines={2}>{item.siteName}</Text>
              <View style={[styles.timeRow, { marginTop: 6 }]}>
                <Text style={{ fontSize: 12 }}>🕐</Text>
                <Text style={[styles.timeText, { color: colors.text, fontSize: 14, fontWeight: '600' }]}>{timeRange}</Text>
              </View>
            </View>
          </View>

          {/* Bottom: Stats Grid */}
          <View style={[styles.statsGrid, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statItemLabel, { color: colors.muted }]}>Duration</Text>
              <Text style={[styles.statItemValue, { color: '#0f172a', fontSize: 15 }]}>{duration}</Text>
            </View>
            <View style={[styles.statItem, styles.statItemBorder, { borderLeftColor: colors.border }]}>
              <Text style={[styles.statItemLabel, { color: colors.muted }]}>Photos</Text>
              <Text style={[styles.statItemValue, { color: '#0f172a', fontSize: 15 }]}>{item.photos.length}</Text>
            </View>
            <View style={[styles.statItem, styles.statItemBorder, { borderLeftColor: colors.border }]}>
              <Text style={[styles.statItemLabel, { color: colors.muted }]}>Distance</Text>
              <Text style={[styles.statItemValue, { color: '#0f172a', fontSize: 15 }]}>{distance}</Text>
            </View>
          </View>
        </View>

        {/* Chevron */}
        <View style={[styles.chevronContainer, { backgroundColor: '#f8fafc' }]}>
          <Text style={{ color: '#94a3b8', fontSize: 20 }}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer className="flex-1">
      <View className="p-6 pb-0">
        <Text className="text-3xl font-bold text-foreground mb-2">Shift History</Text>
        <Text className="text-muted mb-4">View past shifts and generate reports</Text>
      </View>

      {shifts.length === 0 ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-muted text-center text-lg">
            No completed shifts yet.{"\n"}Start and end a shift to see it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={shifts}
          renderItem={renderShiftItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={watermarkStyle}>
        <PhotoWatermark ref={watermarkRef} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    padding: 24,
    paddingTop: 8,
  },
  shiftCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  shiftHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  shiftSite: {
    fontSize: 18,
    fontWeight: "600",
  },
  shiftDate: {
    fontSize: 14,
  },
  shiftStaff: {
    fontSize: 14,
    marginBottom: 8,
  },
  shiftStats: {
    flexDirection: "row",
    gap: 16,
  },
  shiftStat: {
    fontSize: 13,
  },
  detailHeader: {
    marginBottom: 16,
  },
  backButton: {
    fontSize: 16,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 4,
  },
  mapPreview: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    marginBottom: 8,
  },
  mapHint: {
    fontSize: 13,
    textAlign: "center",
  },
  locationItem: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 2,
  },
  locationTime: {
    fontSize: 12,
  },
  locationCount: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  photoGridItem: {
    width: (SCREEN_WIDTH - 80) / 3,
    height: (SCREEN_WIDTH - 80) / 3,
    borderRadius: 8,
    overflow: "hidden",
  },
  photoGridImage: {
    width: "100%",
    height: "100%",
  },
  photoGridOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 4,
  },
  photoGridTime: {
    color: "#FFF",
    fontSize: 10,
    textAlign: "center",
  },
  photoHint: {
    fontSize: 12,
    textAlign: "center",
    fontStyle: "italic",
  },
  actionButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "100%",
    height: "100%",
    paddingTop: 50,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalClose: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    gap: 16,
  },
  modalAction: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalShare: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalImage: {
    flex: 1,
    width: "100%",
  },
  modalInfo: {
    padding: 20,
  },
  modalTime: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  modalAddress: {
    fontSize: 14,
    marginBottom: 4,
  },
  modalCoords: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  // Modern Card Styles
  modernCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  statusBar: {
    width: 6,
  },
  modernCardContent: {
    flex: 1,
    padding: 20,
    paddingLeft: 16,
  },
  modernCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modernDateLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  modernFullDate: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#d1fae5',
  },
  statusBadgeCompleted: {
    backgroundColor: '#f8fafc',
    borderColor: '#f1f5f9',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  locationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  siteName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#64748b',
  },
  statsGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statItemBorder: {
    borderLeftWidth: 1,
    borderLeftColor: '#f1f5f9',
  },
  statItemLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statItemValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  chevronContainer: {
    justifyContent: 'center',
    paddingRight: 12,
  },
});
