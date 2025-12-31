import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import type { Shift, LocationPoint } from "@/lib/shift-types";
import { getActiveShift, getShiftHistory, formatDuration, getShiftDuration } from "@/lib/shift-storage";
import { generatePDFReport } from "@/lib/pdf-generator";
import { getGoogleMapsApiKey } from "@/lib/google-maps";

export default function LiveViewerScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const colors = useColors();
  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const findShift = useCallback(async () => {
    try {
      const active = await getActiveShift();
      if (active && active.pairCode === code?.toUpperCase()) {
        setShift(active);
        setError(null);
        setLastUpdate(new Date());
        return;
      }

      const history = await getShiftHistory();
      const found = history.find(s => s.pairCode === code?.toUpperCase());
      if (found) {
        setShift(found);
        setError(null);
        setLastUpdate(new Date());
        return;
      }

      setError("Shift not found. Please check the pair code.");
    } catch (e) {
      setError("Failed to load shift data");
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    findShift();
    const interval = setInterval(findShift, 10000);
    return () => clearInterval(interval);
  }, [findShift]);

  const handleDownloadReport = async () => {
    if (!shift) return;
    const html = await generatePDFReport(shift);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const handleRefresh = () => {
    setLoading(true);
    findShift();
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <Text style={{ color: colors.foreground, fontSize: 18 }}>Loading...</Text>
        <Text style={{ color: colors.muted, marginTop: 8 }}>Looking for shift: {code}</Text>
      </ScreenContainer>
    );
  }

  if (error || !shift) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text style={{ color: colors.error, fontSize: 24, marginBottom: 16 }}>⚠️</Text>
        <Text style={{ color: colors.foreground, fontSize: 18, textAlign: "center" }}>
          {error || "Shift not found"}
        </Text>
        <Text style={{ color: colors.muted, marginTop: 8, textAlign: "center" }}>
          Pair Code: {code}
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary, marginTop: 24 }]}
          onPress={handleRefresh}
        >
          <Text style={styles.buttonText}>Try Again</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  const duration = formatDuration(getShiftDuration(shift));
  const isLive = shift.isActive;

  return (
    <ScreenContainer>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: isLive ? colors.success : colors.primary }]}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{isLive ? "🔴 LIVE" : "✓ COMPLETED"}</Text>
          </View>
          <Text style={styles.siteName}>{shift.siteName}</Text>
          <Text style={styles.staffName}>{shift.staffName}</Text>
          <Text style={styles.pairCode}>Code: {shift.pairCode}</Text>
        </View>

        {/* Stats */}
        <View style={[styles.statsRow, { borderColor: colors.border }]}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{duration}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Duration</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{shift.photos.length}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Photos</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{shift.locations.length}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Locations</Text>
          </View>
        </View>

        {/* Google Map with Trail */}
        {shift.locations.length > 0 && Platform.OS === "web" && (
          <View style={styles.mapSection}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>📍 Location Trail</Text>
            <GoogleMap locations={shift.locations} isLive={isLive} />
          </View>
        )}

        {/* Location List */}
        {shift.locations.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Trail Points ({shift.locations.length})
            </Text>
            <View style={[styles.locationCard, { borderLeftColor: colors.success }]}>
              <Text style={[styles.locationLabel, { color: colors.success }]}>START</Text>
              <Text style={[styles.locationCoords, { color: colors.foreground }]}>
                {shift.locations[0].latitude.toFixed(6)}, {shift.locations[0].longitude.toFixed(6)}
              </Text>
              <Text style={[styles.locationTime, { color: colors.muted }]}>
                {new Date(shift.locations[0].timestamp).toLocaleString()}
              </Text>
              {shift.locations[0].address && (
                <Text style={[styles.locationAddress, { color: colors.muted }]}>
                  📍 {shift.locations[0].address}
                </Text>
              )}
            </View>
            {shift.locations.length > 1 && (
              <View style={[styles.locationCard, { borderLeftColor: colors.error }]}>
                <Text style={[styles.locationLabel, { color: colors.error }]}>
                  {isLive ? "CURRENT" : "END"}
                </Text>
                <Text style={[styles.locationCoords, { color: colors.foreground }]}>
                  {shift.locations[shift.locations.length - 1].latitude.toFixed(6)}, {shift.locations[shift.locations.length - 1].longitude.toFixed(6)}
                </Text>
                <Text style={[styles.locationTime, { color: colors.muted }]}>
                  {new Date(shift.locations[shift.locations.length - 1].timestamp).toLocaleString()}
                </Text>
                {shift.locations[shift.locations.length - 1].address && (
                  <Text style={[styles.locationAddress, { color: colors.muted }]}>
                    📍 {shift.locations[shift.locations.length - 1].address}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Photos */}
        {shift.photos.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              📷 Photos ({shift.photos.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {shift.photos.map((photo, index) => (
                <View key={photo.id} style={styles.photoItem}>
                  <img src={photo.uri} alt={`Photo ${index + 1}`} style={{ width: 150, height: 150, objectFit: "cover", borderRadius: 8 }} />
                  <Text style={[styles.photoTime, { color: colors.muted }]}>
                    {new Date(photo.timestamp).toLocaleTimeString()}
                  </Text>
                  {photo.address && (
                    <Text style={[styles.photoAddress, { color: colors.muted }]} numberOfLines={1}>
                      {photo.address}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleDownloadReport}
          >
            <Text style={styles.buttonText}>📄 Download PDF Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
            onPress={handleRefresh}
          >
            <Text style={[styles.buttonText, { color: colors.foreground }]}>🔄 Refresh</Text>
          </TouchableOpacity>
        </View>

        {/* Last Update */}
        <Text style={[styles.lastUpdate, { color: colors.muted }]}>
          Last updated: {lastUpdate.toLocaleTimeString()}
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

// Google Maps Component (Web only)
function GoogleMap({ locations, isLive }: { locations: LocationPoint[]; isLive: boolean }) {
  const mapId = "google-map-" + Math.random().toString(36).substr(2, 9);
  const apiKey = getGoogleMapsApiKey();

  useEffect(() => {
    if (Platform.OS !== "web" || locations.length === 0) return;

    // Load Google Maps script
    const existingScript = document.getElementById("google-maps-script");
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "google-maps-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMap`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    // Define callback
    (window as any).initGoogleMap = () => {
      initMap();
    };

    // If Google Maps already loaded
    if ((window as any).google?.maps) {
      initMap();
    }

    function initMap() {
      const google = (window as any).google;
      if (!google?.maps) return;

      const mapContainer = document.getElementById(mapId);
      if (!mapContainer) return;

      // Calculate center
      const lats = locations.map(l => l.latitude);
      const lngs = locations.map(l => l.longitude);
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

      // Create map
      const map = new google.maps.Map(mapContainer, {
        center: { lat: centerLat, lng: centerLng },
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
      });

      // Create trail polyline
      const trailCoords = locations.map(l => ({ lat: l.latitude, lng: l.longitude }));
      const polyline = new google.maps.Polyline({
        path: trailCoords,
        geodesic: true,
        strokeColor: "#0a7ea4",
        strokeOpacity: 1.0,
        strokeWeight: 4,
      });
      polyline.setMap(map);

      // Add start marker (green)
      new google.maps.Marker({
        position: { lat: locations[0].latitude, lng: locations[0].longitude },
        map: map,
        title: "Start: " + new Date(locations[0].timestamp).toLocaleString(),
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#22c55e",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
        label: { text: "S", color: "#ffffff", fontWeight: "bold" },
      });

      // Add end/current marker (red)
      if (locations.length > 1) {
        const endLoc = locations[locations.length - 1];
        const marker = new google.maps.Marker({
          position: { lat: endLoc.latitude, lng: endLoc.longitude },
          map: map,
          title: (isLive ? "Current: " : "End: ") + new Date(endLoc.timestamp).toLocaleString(),
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: isLive ? "#ef4444" : "#6366f1",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
          label: { text: isLive ? "●" : "E", color: "#ffffff", fontWeight: "bold" },
        });

        // Animate current position marker if live
        if (isLive) {
          let scale = 10;
          let growing = true;
          setInterval(() => {
            scale += growing ? 0.5 : -0.5;
            if (scale >= 14) growing = false;
            if (scale <= 10) growing = true;
            marker.setIcon({
              path: google.maps.SymbolPath.CIRCLE,
              scale: scale,
              fillColor: "#ef4444",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeWeight: 3,
            });
          }, 100);
        }
      }

      // Fit bounds
      const bounds = new google.maps.LatLngBounds();
      locations.forEach(loc => bounds.extend({ lat: loc.latitude, lng: loc.longitude }));
      map.fitBounds(bounds, 50);
    }

    return () => {
      const mapContainer = document.getElementById(mapId);
      if (mapContainer) {
        mapContainer.innerHTML = "";
      }
    };
  }, [locations, isLive, mapId, apiKey]);

  if (Platform.OS !== "web") {
    return null;
  }

  return (
    <div
      id={mapId}
      style={{
        width: "100%",
        height: 350,
        borderRadius: 12,
        overflow: "hidden",
        marginTop: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      }}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 24,
    alignItems: "center",
  },
  statusBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  statusText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  siteName: {
    color: "white",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
  },
  staffName: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
    marginTop: 4,
  },
  pairCode: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontFamily: "monospace",
    marginTop: 8,
  },
  statsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    marginTop: 4,
  },
  mapSection: {
    padding: 16,
  },
  section: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  locationCard: {
    borderLeftWidth: 4,
    paddingLeft: 12,
    marginBottom: 12,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  locationCoords: {
    fontFamily: "monospace",
    fontSize: 14,
    marginTop: 4,
  },
  locationTime: {
    fontSize: 13,
    marginTop: 2,
  },
  locationAddress: {
    fontSize: 14,
    marginTop: 4,
  },
  photoItem: {
    marginRight: 12,
    width: 150,
  },
  photoTime: {
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  photoAddress: {
    fontSize: 10,
    textAlign: "center",
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  lastUpdate: {
    textAlign: "center",
    fontSize: 12,
    paddingBottom: 24,
  },
});
