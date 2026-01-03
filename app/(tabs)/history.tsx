import { useState, useCallback } from "react";
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
import { getApiBaseUrl } from "@/constants/oauth";
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
import { batchExportPhotos } from "@/lib/batch-export";
import { addWatermarkToPhoto, formatWatermarkTimestamp } from "@/lib/watermark";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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

export default function HistoryScreen() {
  const colors = useColors();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<ShiftPhoto | null>(null);
  const [startAddress, setStartAddress] = useState<string>("");
  const [endAddress, setEndAddress] = useState<string>("");

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
      
      // Generate watermarked version for sharing
      const watermarkedUri = await addWatermarkToPhoto(photo.uri, {
        timestamp: formatWatermarkTimestamp(new Date(photo.timestamp)),
        address: photo.address || "Location unavailable",
        latitude: photo.location?.latitude || 0,
        longitude: photo.location?.longitude || 0,
        staffName: selectedShift?.staffName,
        siteName: selectedShift?.siteName,
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
        // On mobile, share the watermarked photo
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
          alert("Sharing is not available on this device");
          return;
        }
        
        await Sharing.shareAsync(watermarkedUri, {
          mimeType: "image/jpeg",
          dialogTitle: "Share Timestamp Photo",
        });
      }
    } catch (e) {
      console.error("Share photo error:", e);
      alert("Failed to share photo");
    }
  };

  const exportPhotoWithWatermark = async (photo: ShiftPhoto) => {
    if (!selectedShift) return;
    
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      // Generate watermarked version
      const watermarkedUri = await addWatermarkToPhoto(photo.uri, {
        timestamp: formatWatermarkTimestamp(new Date(photo.timestamp)),
        address: photo.address || "Location unavailable",
        latitude: photo.location?.latitude || 0,
        longitude: photo.location?.longitude || 0,
        staffName: selectedShift.staffName,
        siteName: selectedShift.siteName,
      });
      
      if (Platform.OS === "web") {
        // On web, download watermarked image
        const link = document.createElement("a");
        link.href = watermarkedUri;
        link.download = `timestamp_photo_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        alert("Photo downloaded with watermark!");
      } else {
        // On mobile, share the watermarked photo
        const isAvailable = await Sharing.isAvailableAsync();
        if (!isAvailable) {
          alert("Sharing is not available on this device");
          return;
        }
        
        await Sharing.shareAsync(watermarkedUri, {
          mimeType: "image/jpeg",
          dialogTitle: "Save Timestamp Photo",
        });
      }
    } catch (error) {
      console.error("Export error:", error);
      alert("Error exporting photo. Please try again.");
    }
  };

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

  // Photo Viewer Modal
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
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => exportPhotoWithWatermark(selectedPhoto)}>
                  <Text style={[styles.modalAction, { color: colors.primary }]}>💾 Export</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => sharePhoto(selectedPhoto)}>
                  <Text style={[styles.modalAction, { color: colors.primary }]}>📤 Share</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <Image source={{ uri: selectedPhoto.uri }} style={styles.modalImage} resizeMode="contain" />
            
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

  // Shift Detail View
  if (selectedShift) {
    const duration = formatDuration(getShiftDuration(selectedShift));
    const mapUrl = generateStaticMapUrlEncoded(selectedShift.locations, 600, 300);

    return (
      <ScreenContainer>
        <PhotoViewerModal />
        <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedShift(null)}>
              <Text style={[styles.backButton, { color: colors.primary }]}>← Back</Text>
            </TouchableOpacity>
          </View>

          <Text className="text-2xl font-bold text-foreground mb-1">{selectedShift.siteName}</Text>
          <Text className="text-muted mb-6">{selectedShift.staffName} • {selectedShift.pairCode}</Text>

          {/* Stats Cards */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{duration}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Duration</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{selectedShift.photos.length}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Photos</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{selectedShift.locations.length}</Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>Locations</Text>
            </View>
          </View>

          {/* Time Info */}
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.infoTitle, { color: colors.foreground }]}>⏰ Shift Time</Text>
            <Text style={[styles.infoText, { color: colors.muted }]}>
              Start: {new Date(selectedShift.startTime).toLocaleString()}
            </Text>
            <Text style={[styles.infoText, { color: colors.muted }]}>
              End: {selectedShift.endTime ? new Date(selectedShift.endTime).toLocaleString() : "In Progress"}
            </Text>
          </View>

          {/* Trail Map Preview */}
          {mapUrl && (
            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.infoTitle, { color: colors.foreground }]}>🗺️ Trail Map</Text>
              <TouchableOpacity onPress={() => viewTrailOnMap(selectedShift)}>
                <Image 
                  source={{ uri: mapUrl }} 
                  style={styles.mapPreview}
                  resizeMode="cover"
                />
                <Text style={[styles.mapHint, { color: colors.primary }]}>Tap to view full map →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Location Trail */}
          {selectedShift.locations.length > 0 && (
            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.infoTitle, { color: colors.foreground }]}>📍 Location Trail</Text>
              
              <View style={styles.locationItem}>
                <Text style={[styles.locationLabel, { color: colors.success }]}>START</Text>
                <Text style={[styles.locationAddress, { color: colors.foreground }]}>{startAddress}</Text>
                <Text style={[styles.locationTime, { color: colors.muted }]}>
                  {new Date(selectedShift.locations[0].timestamp).toLocaleTimeString()}
                </Text>
              </View>
              
              {selectedShift.locations.length > 1 && (
                <View style={styles.locationItem}>
                  <Text style={[styles.locationLabel, { color: colors.error }]}>END</Text>
                  <Text style={[styles.locationAddress, { color: colors.foreground }]}>{endAddress}</Text>
                  <Text style={[styles.locationTime, { color: colors.muted }]}>
                    {new Date(selectedShift.locations[selectedShift.locations.length - 1].timestamp).toLocaleTimeString()}
                  </Text>
                </View>
              )}
              
              <Text style={[styles.locationCount, { color: colors.muted }]}>
                {selectedShift.locations.length} location points recorded
              </Text>
            </View>
          )}

          {/* Photos Gallery */}
          {selectedShift.photos.length > 0 && (
            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.infoTitle, { color: colors.foreground }]}>📷 Photos ({selectedShift.photos.length})</Text>
              <View style={styles.photoGrid}>
                {selectedShift.photos.map((photo) => (
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
              <Text style={[styles.photoHint, { color: colors.muted }]}>Tap a photo to view full size and share</Text>
            </View>
          )}

          {/* Action Buttons */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              const apiUrl = getApiBaseUrl();
              const viewerUrl = `${apiUrl}/viewer/${selectedShift.pairCode}`;
              Linking.openURL(viewerUrl);
            }}
          >
            <Text style={styles.actionButtonText}>🔗 View Web Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#8b5cf6" }]}
            onPress={() => viewPDFReport(selectedShift)}
          >
            <Text style={styles.actionButtonText}>📄 Download PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#6366f1" }]}
            onPress={() => generateTextReport(selectedShift)}
          >
            <Text style={styles.actionButtonText}>📤 Share as Text</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.success }]}
            onPress={() => viewTrailOnMap(selectedShift)}
          >
            <Text style={styles.actionButtonText}>🗺️ View Trail on Map</Text>
          </TouchableOpacity>

          {selectedShift.photos.length > 0 && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: "#f59e0b" }]}
              onPress={exportAllPhotos}
            >
              <Text style={styles.actionButtonText}>📦 Export All Photos</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.error }]}
            onPress={() => handleDeleteShift(selectedShift.id)}
          >
            <Text style={styles.actionButtonText}>🗑️ Delete Shift</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </ScreenContainer>
    );
  }

  // Shift List
  const renderShiftItem = ({ item }: { item: Shift }) => {
    const duration = formatDuration(getShiftDuration(item));
    const date = new Date(item.startTime).toLocaleDateString();
    const time = new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <TouchableOpacity
        style={[styles.shiftCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => handleSelectShift(item)}
      >
        <View style={styles.shiftHeader}>
          <Text style={[styles.shiftSite, { color: colors.foreground }]}>{item.siteName}</Text>
          <Text style={[styles.shiftDate, { color: colors.muted }]}>{date}</Text>
        </View>
        <Text style={[styles.shiftStaff, { color: colors.muted }]}>{item.staffName} • {time}</Text>
        <View style={styles.shiftStats}>
          <Text style={[styles.shiftStat, { color: colors.muted }]}>⏱️ {duration}</Text>
          <Text style={[styles.shiftStat, { color: colors.muted }]}>📷 {item.photos.length}</Text>
          <Text style={[styles.shiftStat, { color: colors.muted }]}>📍 {item.locations.length}</Text>
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
});
