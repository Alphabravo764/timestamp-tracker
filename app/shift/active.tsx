import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Platform,
  Dimensions,
  Animated,
  Image,
  Clipboard,
  Linking,
  TextInput,
  Modal,
} from "react-native";
import { PhotoWatermark, type PhotoWatermarkRef } from "@/components/photo-watermark";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import * as Location from "expo-location";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  getActiveShift as getLocalActiveShift,
  addPhotoToShift,
  endShift as endLocalShift,
  addLocationToShift,
  addNoteToShift,
} from "@/lib/shift-storage";
import type { Shift } from "@/lib/shift-types";
import { getSettings, canGenerateReport, incrementReportCount, canShareLiveView, incrementLiveShareCount, getPremiumStatus } from "@/lib/settings-storage";
import { router, useFocusEffect } from "expo-router";
import { syncLocation, syncShiftEnd, syncPhoto, syncNote } from "@/lib/server-sync";
import { uploadPhotoDirect, photoToBase64DataUri } from "@/lib/direct-upload";
import { mapboxReverseGeocode } from "@/lib/mapbox";
import { LeafletMap } from "@/components/LeafletMap";
import { ScreenErrorBoundary } from "@/components/ScreenErrorBoundary";
import { getFreshLocation } from "@/lib/fresh-location";
import { hasValidCoords, safeToFixed } from "@/lib/safe-coords";
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { generatePdfHtml } from "@/lib/pdf-generator";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function ActiveShiftScreenContent({ onShiftEnd }: { onShiftEnd?: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string>("Locating...");
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const watermarkRef = useRef<PhotoWatermarkRef>(null);
  const [processing, setProcessing] = useState(false);

  // UI States from template
  const [showQr, setShowQr] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Load shift from LOCAL storage (source of truth)
  // showLoading: false prevents the loading flash when just refreshing data (e.g. after photo)
  const loadShift = useCallback(async (showLoading: boolean = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      const shift = await getLocalActiveShift();
      if (shift && shift.isActive) {
        setActiveShift(shift);
      } else {
        setActiveShift(null);
      }
    } catch (e) {
      console.error("Failed to load shift:", e);
      setActiveShift(null);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, []);

  // Reload on screen focus
  useFocusEffect(
    useCallback(() => {
      loadShift();
    }, [loadShift])
  );

  // Pulse animation for live indicator
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Start location tracking
  useEffect(() => {
    if (!activeShift) return;

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;

        const settings = await getSettings();
        const interval = (settings.locationInterval || 30) * 1000;

        // INSTANT: Get last known position first (no network delay)
        const lastKnown = await Location.getLastKnownPositionAsync({});
        if (lastKnown) {
          setCurrentLocation(lastKnown);
          setCurrentAddress(`${lastKnown.coords.latitude.toFixed(4)}, ${lastKnown.coords.longitude.toFixed(4)}`);
          // Background geocode (non-blocking)
          mapboxReverseGeocode(
            lastKnown.coords.latitude,
            lastKnown.coords.longitude
          ).then((address: string) => {
            if (address) setCurrentAddress(address);
          }).catch(() => { });
        }

        // Background: Try fresh location with short timeout (non-blocking update)
        Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000))
        ]).then((freshLoc) => {
          if (freshLoc && freshLoc.coords && freshLoc.coords.latitude !== 0) {
            setCurrentLocation(freshLoc as Location.LocationObject);
            mapboxReverseGeocode(
              freshLoc.coords.latitude,
              freshLoc.coords.longitude
            ).then((address: string) => {
              if (address) setCurrentAddress(address);
            }).catch(() => { });
          }
        }).catch(() => { });

        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: interval,
            distanceInterval: 10,
          },
          async (location) => {
            setCurrentLocation(location);

            // Save to local storage
            await addLocationToShift({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy || undefined,
              timestamp: new Date().toISOString()
            });

            // Update address occasionally if not tracking
            // Use Mapbox sparingly or fallback
            // We won't block here.

            // Sync to server (non-blocking) - log for debugging
            if (activeShift?.pairCode) {
              const syncPayload = {
                pairCode: activeShift.pairCode,
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy || undefined,
                timestamp: new Date().toISOString()
              };
              console.log('[SYNC] Sending location update:', syncPayload.pairCode, syncPayload.latitude.toFixed(4), syncPayload.longitude.toFixed(4));
              syncLocation(syncPayload)
                .then(() => console.log('[SYNC] Location synced successfully'))
                .catch(err => console.error('[SYNC] Location sync failed:', err));
            }
          }
        );
      } catch (error) {
        console.error("Location tracking error:", error);
      }
    };

    startLocationTracking();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, [activeShift?.id]);

  const handleCopyCode = () => {
    if (activeShift?.pairCode) {
      Clipboard.setString(activeShift.pairCode);
      setIsCopied(true);
      if (Platform.OS !== "web") {
        Haptics.selectionAsync();
      }
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleTakePhoto = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert("Permission Required", "Camera access is needed to take photos.");
        return;
      }
    }
    setShowCamera(true);
  };

  const capturePhoto = async () => {
    if (!cameraRef.current || processing) return;

    // Photo cap for trial users (premium codes bypass this)
    const premiumStatus = await getPremiumStatus();
    const TRIAL_PHOTO_LIMIT = 30;

    if (!premiumStatus.isPremium && activeShift && (activeShift.photos || []).length >= TRIAL_PHOTO_LIMIT) {
      Alert.alert(
        "Photo Limit Reached",
        `Trial version limited to ${TRIAL_PHOTO_LIMIT} photos per shift. Please end this shift to continue, or upgrade with a premium code in Settings.`,
        [
          { text: "OK", style: "cancel" },
          { text: "Go to Settings", onPress: () => router.push("/(tabs)/settings") }
        ]
      );
      return;
    }

    setProcessing(true);
    try {
      // 1. INSTANT photo capture
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
        exif: true,
        skipProcessing: true
      });

      if (!photo?.uri) throw new Error("Photo capture failed");

      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      const now = Date.now();
      const timestamp = new Date(now).toISOString();

      // 2. USE CACHED LOCATION IMMEDIATELY - DON'T WAIT!
      // currentLocation is already being tracked in useEffect
      let lat = currentLocation?.coords?.latitude || 0;
      let lng = currentLocation?.coords?.longitude || 0;
      let accuracy = currentLocation?.coords?.accuracy || 0;
      let address = currentAddress || "Location pending";

      console.log('[Photo] Using cached location:', { lat, lng, accuracy, address });

      // 3. Save photo IMMEDIATELY with cached location
      const photoId = `photo_${now}`;

      try {
        await addPhotoToShift({
          id: photoId,
          uri: photo.uri,
          timestamp,
          ts: now,  // Unix timestamp for consistent sorting
          location: lat && lng ? {
            latitude: lat,
            longitude: lng,
            timestamp: timestamp,
            accuracy: accuracy
          } : null,
          address
        });
        console.log('[Photo] Photo saved successfully:', photoId);
      } catch (saveError) {
        console.error('[Photo] Failed to save photo:', saveError);
        Alert.alert("Storage Error", "Failed to save photo. Please try again.");
        setProcessing(false);
        return;
      }

      // 4. Close camera and update UI IMMEDIATELY
      setShowCamera(false);

      // Reload shift to show the new photo in UI
      try {
        await loadShift(false);
      } catch (loadError) {
        console.error('[Photo] Failed to reload shift:', loadError);
        // Continue anyway - photo is saved locally
      }

      // 5. Background: Direct upload to storage (Fire-and-forget)
      const pairCode = activeShift?.pairCode;
      const shiftId = activeShift?.id;
      const photoPath = photo.uri;

      if (pairCode && shiftId && photoPath) {
        // Run in background - do NOT await
        uploadPhotoDirect(photoPath, {
          shiftId,
          pairCode,
          timestamp,
          latitude: lat,
          longitude: lng,
          accuracy,
          address
        })
          .then((publicUrl) => {
            console.log('[Direct Upload] Photo uploaded successfully:', publicUrl);
          })
          .catch(err => {
            console.error('[Direct Upload] Background upload failed:', err);
            // No base64 fallback - prevents out-of-memory crashes
            // TODO: Queue for retry logic
          });
      }

    } catch (error) {
      console.error("Photo capture error:", error);
      Alert.alert("Error", `Failed to capture photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleEndShift = async () => {
    Alert.alert(
      "End Shift",
      "Are you sure you want to end your shift?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Shift",
          style: "destructive",
          onPress: async () => {
            if (!activeShift) return;

            // Stop tracking first
            if (locationSubscription.current) {
              locationSubscription.current.remove();
              locationSubscription.current = null;
            }

            // 1. Add final location point if available (single arg signature)
            if (currentLocation) {
              try {
                await addLocationToShift({
                  latitude: currentLocation.coords.latitude,
                  longitude: currentLocation.coords.longitude,
                  accuracy: currentLocation.coords.accuracy ?? undefined,
                  timestamp: new Date().toISOString()
                });
              } catch (e) {
                console.log("Failed to add final location", e);
              }
            }

            // 2. End the shift locally
            try {
              const endedShift = await endLocalShift();

              // 3. Sync in background (don't wait)
              if (endedShift) {
                const payload = {
                  ...endedShift,
                  endTime: endedShift.endTime || new Date().toISOString()
                };
                syncShiftEnd(payload).catch(err => console.log("Offline sync pending"));
              }

              // 4. Navigate to home - ALWAYS navigate
              if (onShiftEnd) {
                onShiftEnd();
              } else {
                router.replace("/(tabs)");
              }

            } catch (e: any) {
              console.error("End shift error:", e);
              // Still navigate even on error
              if (onShiftEnd) {
                onShiftEnd();
              } else {
                router.replace("/(tabs)");
              }
            }
          }
        }
      ]
    );
  };

  const handleGenerateReport = async () => {
    if (!activeShift) return;

    try {
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      Alert.alert(
        "Generate Report",
        "This will create a PDF with your shift data, map trail, and photos. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Generate",
            onPress: async () => {
              // Check trial limits
              const { allowed } = await canGenerateReport();
              if (!allowed) {
                Alert.alert(
                  "Trial Limit Reached",
                  "You've reached the trial limit for reports.\nPremium options are coming soon.",
                  [{ text: "Got it" }]
                );
                return;
              }

              try {
                // Generate HTML with map polyline
                const html = await generatePdfHtml(activeShift);

                // Print/Share the PDF
                await Print.printAsync({ html });

                // Increment usage counter
                await incrementReportCount();

                if (Platform.OS !== "web") {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              } catch (e) {
                console.error("PDF generation error:", e);
                Alert.alert("Error", "Failed to generate report. Please try again.");
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error("Report error:", error);
    }
  };

  const handleShareLink = async () => {
    if (!activeShift?.pairCode) return;

    // Check trial limits
    const { allowed } = await canShareLiveView();
    if (!allowed) {
      Alert.alert(
        "Trial Limit Reached",
        "You've reached the trial limit for live shares.\nPremium options are coming soon.",
        [{ text: "Got it" }]
      );
      return;
    }

    const url = `https://stampia.tech/viewer/${activeShift.pairCode}`;
    try {
      await Share.share({
        message: `Track my shift live: ${url}`,
        url: url,
      });

      // Increment usage counter
      await incrementLiveShareCount();
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  // Loading state
  if (isLoading) {
    // Return empty view or light loader
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // No active shift
  if (!activeShift) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.error || "#ef4444"} style={{ marginBottom: 16 }} />
        <Text style={[styles.titleText, { color: colors.text }]}>No Active Shift</Text>
        <Text style={[styles.subtitleText, { color: colors.muted }]}>Start a new shift from the Home screen</Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.primaryButtonText}>Go to Home</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  // Camera view
  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        <View style={[styles.cameraOverlay, { paddingTop: insets.top }]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowCamera(false)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={[styles.cameraControls, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity
            style={[styles.captureButton, processing && styles.captureButtonDisabled]}
            onPress={capturePhoto}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#4f46e5" size="small" />
            ) : (
              <View style={styles.captureButtonInner} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Generate static map URL using Google Maps with location trail
  // Determine display location for the map (GPS > Last Shift Location > Default)
  const locations = activeShift?.locations || [];
  const lastLocation = locations.length > 0 ? locations[locations.length - 1] : null;

  const displayLocation = currentLocation?.coords ? {
    latitude: currentLocation.coords.latitude,
    longitude: currentLocation.coords.longitude
  } : (lastLocation ? {
    latitude: lastLocation.latitude,
    longitude: lastLocation.longitude
  } : null);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatarContainer, { backgroundColor: colors.surface }]}>
            <Image
              source={require('@/assets/images/icon.png')}
              style={{ width: 28, height: 28, borderRadius: 4 }}
              resizeMode="contain"
            />
          </View>
          <View>
            <Text style={[styles.appName, { color: colors.text }]}>Proof of Presence</Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDotContainer}>
                <Animated.View style={[styles.liveDotPing, { transform: [{ scale: pulseAnim }], backgroundColor: colors.primary }]} />
                <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
              </View>
              <Text style={[styles.liveText, { color: colors.primary }]}>Live Active</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.bellButton}>
          <Ionicons name="notifications-outline" size={24} color={colors.muted} />
          <View style={styles.notificationDot} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Hero Card (Pair Code) */}
        <LinearGradient
          colors={showQr ? ["#1e293b", "#0f172a"] : [colors.primary, "#4338ca"]} // Adaptable gradient? hardcoded for brand maybe fine
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          {/* Texture Overlay */}
          <View style={styles.textureCircle} />

          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>PAIR CODE</Text>
              <Text style={styles.cardSubtitle}>Share this to link device</Text>
            </View>
            <TouchableOpacity
              style={styles.qrToggle}
              onPress={() => setShowQr(!showQr)}
            >
              {showQr ? (
                <Text style={styles.qrToggleText}>123</Text>
              ) : (
                <Ionicons name="qr-code-outline" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {showQr ? (
            <View style={styles.qrContainer}>
              <View style={styles.qrFrame}>
                <Ionicons name="qr-code" size={120} color="#0f172a" />
              </View>
              <Text style={styles.qrHint}>Scan to pair instantly</Text>
            </View>
          ) : (
            <View style={styles.codeContainer}>
              <Text style={styles.pairCodeLarge}>{activeShift.pairCode}</Text>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={handleCopyCode}
              >
                {isCopied ? (
                  <Text style={[styles.copyText, { color: "#6ee7b7", fontWeight: "700" }]}>Copied!</Text>
                ) : (
                  <>
                    <Ionicons name="copy-outline" size={14} color="#dbeafe" />
                    <Text style={styles.copyText}>Tap to copy</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.shareButton} onPress={handleShareLink}>
            <Ionicons name="share-social-outline" size={18} color="#1d4ed8" />
            <Text style={styles.shareButtonText}>Share Location & Code</Text>
          </TouchableOpacity>

          {/* Action Row: End Shift + Report */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: '#fee2e2', flex: 1 }]}
              onPress={handleEndShift}
            >
              <Ionicons name="stop-circle-outline" size={18} color="#dc2626" />
              <Text style={[styles.shareButtonText, { color: '#dc2626' }]}>End Shift</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: '#f0fdf4', flex: 1 }]}
              onPress={handleGenerateReport}
            >
              <Ionicons name="document-text-outline" size={18} color="#16a34a" />
              <Text style={[styles.shareButtonText, { color: '#16a34a' }]}>Report</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* 2. Location (Mini-Map) */}
        <TouchableOpacity
          style={[styles.mapCard, { backgroundColor: colors.surface }]} // White usually
          activeOpacity={0.9}
          onPress={() => {
            const loc = currentLocation?.coords || (activeShift.locations.length > 0 ? activeShift.locations[activeShift.locations.length - 1] : null);
            if (loc) {
              const url = Platform.select({
                ios: `maps://app?daddr=${loc.latitude},${loc.longitude}`,
                android: `geo:${loc.latitude},${loc.longitude}?q=${loc.latitude},${loc.longitude}`,
                default: `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`
              });
              Linking.openURL(url);
            }
          }}
        >
          <View style={styles.mapContainer}>
            {displayLocation ? (
              <LeafletMap
                latitude={displayLocation.latitude}
                longitude={displayLocation.longitude}
                height={160}
              />
            ) : (
              // Placeholder when absolutely no location data
              <View style={[styles.mapPlaceholder, { backgroundColor: colors.background }]}>
                <View style={styles.mapPattern} />
                <View style={styles.pinContainer}>
                  <View style={styles.pinPulseWrapper}>
                    <View style={styles.pinPulse} />
                    <View style={styles.pin}>
                      <Ionicons name="location" size={20} color="#fff" />
                    </View>
                  </View>
                  <View style={styles.pinLabel}>
                    <Text style={styles.pinLabelText}>Locating...</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Overlay Text */}
            <View style={styles.mapOverlay}>
              <View style={styles.mapInfo}>
                <Text style={styles.mapLabel}>CURRENT LOCATION</Text>
                <Text style={styles.mapAddress} numberOfLines={1}>{currentAddress}</Text>
              </View>
              <View style={styles.mapArrow}>
                <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* 3. Stats Grid */}
        <View style={styles.statsGrid}>
          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.surface }]}
            activeOpacity={0.8}
            onPress={() => router.push("/shift/gallery" as any)}
          >
            <View style={[styles.statBadge, { backgroundColor: "#e0e7ff" }]}>
              <Ionicons name="images" size={20} color="#4f46e5" />
            </View>
            <Text style={[styles.statNumber, { color: colors.text }]}>{(activeShift?.photos || []).length}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>View Gallery</Text>
            <View style={[styles.statDecor, { backgroundColor: "#e0e7ff" }]} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { backgroundColor: colors.surface }]}
            activeOpacity={0.8}
            onPress={() => setShowNotesModal(true)}
          >
            <View style={[styles.statBadge, { backgroundColor: "#fef3c7" }]}>
              <Ionicons name="document-text" size={20} color="#d97706" />
            </View>
            <Text style={[styles.statNumber, { color: colors.text }]}>{activeShift.notes?.length || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Add Notes</Text>
            <View style={[styles.statDecor, { backgroundColor: "#fef3c7" }]} />
          </TouchableOpacity>
        </View>

        {/* 4. Timeline / Notes */}
        <View style={styles.timelineSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Updates</Text>
            {/* View All button removed per user request */}
          </View>

          <View style={[styles.timelineList, { backgroundColor: colors.surface }]}>
            {/* Start Event */}
            <View style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineDot, { backgroundColor: '#22c55e' }]} />
                <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
              </View>
              <View style={[styles.timelineCard, { borderLeftColor: '#22c55e', borderLeftWidth: 3 }]}>
                <View style={styles.timelineHeader}>
                  <View style={[styles.tagSystem, { backgroundColor: '#dcfce7' }]}>
                    <Text style={[styles.tagTextSystem, { color: '#16a34a' }]}>Start</Text>
                  </View>
                  <View style={styles.timeTag}>
                    <Ionicons name="time-outline" size={10} color={colors.muted} />
                    <Text style={[styles.timeText, { color: colors.muted }]}>
                      {new Date(activeShift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.timelineBody, { color: colors.text, fontWeight: '600' }]}>
                  {activeShift.staffName} clocked in at {activeShift.siteName}
                </Text>
                {activeShift.locations?.[0] && (
                  <Text style={[styles.timelineBody, { color: colors.muted, fontSize: 11, marginTop: 4 }]}>
                    📍 {currentAddress || 'Loading address...'}{'\n'}
                    ({activeShift.locations[0].latitude.toFixed(5)}, {activeShift.locations[0].longitude.toFixed(5)})
                  </Text>
                )}
              </View>
            </View>

            {/* Unified Timeline - Photos and Notes merged and sorted by time */}
            {(() => {
              // Guard against null activeShift during refresh
              if (!activeShift) return null;

              // Create unified event list
              const events: Array<{
                type: 'photo' | 'note';
                ts: number;
                id: string;
                data: any;
              }> = [
                  ...(activeShift.photos || []).map((photo: any) => ({
                    type: 'photo' as const,
                    ts: photo.ts || new Date(photo.timestamp).getTime(),
                    id: photo.id,
                    data: photo,
                  })),
                  ...(activeShift.notes || []).map((note: any) => ({
                    type: 'note' as const,
                    ts: note.ts || new Date(note.timestamp).getTime(),
                    id: note.id,
                    data: note,
                  })),
                ];

              // Sort by timestamp ascending (oldest first)
              events.sort((a, b) => a.ts - b.ts);

              // Take last 5 events (reversed to show newest first)
              const recentEvents = events.slice(-5).reverse();

              return recentEvents.map((event, idx) => {
                if (event.type === 'photo') {
                  const photo = event.data;
                  return (
                    <TouchableOpacity
                      style={styles.timelineItem}
                      key={photo.id}
                      onPress={() => router.push("/shift/gallery" as any)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.timelineLeft}>
                        <View style={[styles.timelineDot, { backgroundColor: "#3b82f6" }]} />
                        {idx !== recentEvents.length - 1 && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
                      </View>
                      <View style={[styles.timelineCard, { borderLeftColor: "#3b82f6", borderLeftWidth: 3 }]}>
                        <View style={styles.timelineHeader}>
                          <View style={[styles.tagSystem, { backgroundColor: "#dbeafe" }]}>
                            <Text style={[styles.tagTextSystem, { color: "#1d4ed8" }]}>Photo</Text>
                          </View>
                          <View style={styles.timeTag}>
                            <Ionicons name="time-outline" size={10} color={colors.muted} />
                            <Text style={[styles.timeText, { color: colors.muted }]}>
                              {new Date(photo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                          </View>
                        </View>
                        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                          <Image
                            source={{ uri: photo.uri }}
                            style={{ width: 60, height: 60, borderRadius: 8, marginRight: 12 }}
                            resizeMode="cover"
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.timelineBody, { color: colors.text }]} numberOfLines={1}>
                              {photo.address || "Photo captured"}
                            </Text>
                            {photo.location && hasValidCoords(photo.location.latitude, photo.location.longitude) && (
                              <Text style={{ color: colors.muted, fontSize: 10, marginTop: 2 }}>
                                ({safeToFixed(photo.location.latitude, 5)}, {safeToFixed(photo.location.longitude, 5)})
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                } else {
                  const note = event.data;
                  return (
                    <View style={styles.timelineItem} key={note.id || idx}>
                      <View style={styles.timelineLeft}>
                        <View style={[styles.timelineDot, { backgroundColor: "#f59e0b" }]} />
                        {idx !== recentEvents.length - 1 && <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />}
                      </View>
                      <View style={[styles.timelineCard, { borderLeftColor: "#f59e0b", borderLeftWidth: 3 }]}>
                        <View style={styles.timelineHeader}>
                          <View style={[styles.tagSystem, { backgroundColor: "#fef3c7" }]}>
                            <Text style={[styles.tagTextSystem, { color: "#d97706" }]}>Note</Text>
                          </View>
                          <View style={styles.timeTag}>
                            <Ionicons name="time-outline" size={10} color={colors.muted} />
                            <Text style={[styles.timeText, { color: colors.muted }]}>
                              {note.timestamp ? new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : "Now"}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.timelineBody, { color: colors.text }]} numberOfLines={2}>
                          {note.text || note}
                        </Text>
                        {(note.address || note.location) && (
                          <Text style={{ color: colors.muted, fontSize: 10, marginTop: 4 }}>
                            📍 {note.address || ''}{note.address && note.location ? '\n' : ''}
                            {note.location && `(${note.location.latitude.toFixed(5)}, ${note.location.longitude.toFixed(5)})`}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                }
              });
            })()}

          </View>
        </View>

        {/* Spacer for Tab Bar */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 100 }]}
        onPress={handleTakePhoto}
      >
        <Ionicons name="camera" size={28} color="#fff" />
      </TouchableOpacity>



      {/* Hidden watermark component */}
      <PhotoWatermark ref={watermarkRef} />

      {/* Inline Notes Modal */}
      <Modal
        visible={showNotesModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNotesModal(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 }}
          activeOpacity={1}
          onPress={() => setShowNotesModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 20, width: '100%', maxWidth: 400 }}
            onPress={() => { }} // Prevent closing when tapping inside
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Add Note</Text>
              <TouchableOpacity onPress={() => setShowNotesModal(false)}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 16,
                minHeight: 120,
                fontSize: 16,
                textAlignVertical: 'top',
                backgroundColor: colors.background,
                color: colors.text
              }}
              placeholder="Type your note here..."
              placeholderTextColor={colors.muted}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              autoFocus
            />

            <TouchableOpacity
              style={{
                backgroundColor: colors.primary,
                paddingVertical: 14,
                borderRadius: 12,
                marginTop: 16,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8
              }}
              onPress={async () => {
                if (noteText.trim()) {
                  // Get fresh location for this note (fast timeout)
                  const freshLoc = await getFreshLocation({ timeout: 2000 });
                  console.log('[Note] Fresh location captured:', freshLoc);

                  // Pass location to addNoteToShift
                  await addNoteToShift(noteText.trim(), freshLoc || undefined);

                  // Sync note to server
                  if (activeShift?.pairCode) {
                    syncNote({
                      pairCode: activeShift.pairCode,
                      text: noteText.trim(),
                      timestamp: new Date().toISOString(),
                      latitude: freshLoc?.latitude,
                      longitude: freshLoc?.longitude,
                      accuracy: freshLoc?.accuracy,
                      address: freshLoc?.address,
                    }).catch(e => console.log('Note sync error:', e));
                  }
                  setNoteText("");
                  setShowNotesModal(false);
                  loadShift(false); // Refresh shift data without loading flash
                  if (Platform.OS !== "web") {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }
                }
              }}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Save Note</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 6,
  },
  liveDotContainer: {
    width: 8,
    height: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  liveDotPing: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    opacity: 0.5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bellButton: {
    position: "relative",
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  scrollContent: {
    padding: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  titleText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 24,
    textAlign: "center",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4f46e5",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  heroCard: {
    padding: 24,
    borderRadius: 24,
    marginBottom: 16,
    overflow: "hidden",
    position: "relative",
  },
  textureCircle: {
    position: "absolute",
    top: -100,
    right: -100,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.7)",
    marginBottom: 4,
    letterSpacing: 1,
  },
  cardSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
  },
  qrToggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  qrToggleText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
  },
  codeContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  pairCodeLarge: {
    fontSize: 48,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 4,
    marginBottom: 8,
    fontVariant: ["tabular-nums"],
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  copyText: {
    fontSize: 12,
    color: "#dbeafe",
    fontWeight: "600",
  },
  qrContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  qrFrame: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 12,
  },
  qrHint: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
  },
  shareButton: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  mapCard: {
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 16,
    height: 120,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPattern: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.1,
    // Assuming pattern image or style
  },
  pinContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -24,
    marginTop: -32,
    alignItems: "center",
  },
  pinPulseWrapper: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  pinPulse: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(37, 99, 235, 0.2)",
  },
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  pinLabel: {
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  pinLabelText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1e293b",
  },
  mapOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,255,255,0.9)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  mapInfo: {
    flex: 1,
    marginRight: 12,
  },
  mapLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
    marginBottom: 2,
  },
  mapAddress: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1e293b",
  },
  mapArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    position: "relative",
    overflow: "hidden",
  },
  statBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  statDecor: {
    position: "absolute",
    top: -20,
    right: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    opacity: 0.1,
  },
  timelineSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  viewAllButton: {
    padding: 4,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4f46e5",
  },
  timelineList: {
    borderRadius: 20,
    padding: 16,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 24,
  },
  timelineLeft: {
    alignItems: "center",
    width: 24,
    marginRight: 12,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#fff",
    zIndex: 1,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: -2,
    marginBottom: -10,
    borderRadius: 1,
  },
  timelineCard: {
    flex: 1,
    paddingLeft: 4,
  },
  timelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  tagSystem: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagTextSystem: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  timeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  timelineBody: {
    fontSize: 13,
    lineHeight: 20,
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  cameraOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: 20,
    flexDirection: "row",
    justifyContent: "flex-end",
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.5)",
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
  },
});

export default function ActiveShiftScreen(props: { onShiftEnd?: () => void }) {
  return (
    <ScreenErrorBoundary>
      <ActiveShiftScreenContent {...props} />
    </ScreenErrorBoundary>
  );
}
