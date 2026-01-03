import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Image } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import type { Shift, LocationPoint } from "@/lib/shift-types";
import { formatDuration, getShiftDuration } from "@/lib/shift-storage";
import { generatePDFReport } from "@/lib/pdf-generator";
import { getGoogleMapsApiKey } from "@/lib/google-maps";
// Use Railway production URL for API calls
const RAILWAY_API_URL = "https://timestamp-tracker-production.up.railway.app";

// Convert API response to local Shift type
function apiResponseToShift(data: any): Shift {
  return {
    id: data.shift.id,
    siteName: data.shift.siteName,
    staffName: data.shift.staffName || "Staff",
    pairCode: data.shift.pairCode,
    startTime: new Date(data.shift.startTime).toISOString(),
    endTime: data.shift.endTime ? new Date(data.shift.endTime).toISOString() : null,
    isActive: data.shift.status === "active",
    locations: data.locations.map((loc: any) => ({
      latitude: loc.latitude,
      longitude: loc.longitude,
      address: loc.address,
      timestamp: new Date(loc.timestamp).toISOString(),
      accuracy: loc.accuracy,
    })),
    photos: data.photos.map((photo: any) => ({
      id: photo.id,
      uri: photo.uri,
      timestamp: new Date(photo.timestamp).toISOString(),
      address: photo.address,
      location: photo.latitude && photo.longitude ? {
        latitude: photo.latitude,
        longitude: photo.longitude,
        timestamp: new Date(photo.timestamp).toISOString(),
      } : null,
    })),
    notes: [],
  };
}

export default function LiveViewerScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const colors = useColors();
  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchShiftFromApi = useCallback(async () => {
    if (!code) {
      setError("No pair code provided");
      setLoading(false);
      return;
    }

    try {
      const apiUrl = RAILWAY_API_URL;
      const normalizedCode = code.replace(/-/g, "").toUpperCase();
      
      const response = await fetch(`${apiUrl}/api/trpc/shifts.getByPairCode?input=${encodeURIComponent(JSON.stringify({ json: { pairCode: normalizedCode } }))}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to fetch shift data");

      const result = await response.json();
      const data = result?.result?.data?.json;
      
      if (!data || !data.shift) {
        setError("Shift not found. Please check the pair code.");
        setShift(null);
      } else {
        setShift(apiResponseToShift(data));
        setError(null);
        setLastUpdate(new Date());
      }
    } catch (e: any) {
      console.error("API fetch error:", e);
      setError(`Failed to load shift data: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchShiftFromApi();
    const interval = setInterval(fetchShiftFromApi, 10000);
    return () => clearInterval(interval);
  }, [fetchShiftFromApi]);

  const handleDownloadReport = async () => {
    if (!shift) return;
    try {
      const html = await generatePDFReport(shift);
      if (Platform.OS === "web") {
        const blob = new Blob([html], { type: "text/html" });
        window.open(URL.createObjectURL(blob), "_blank");
      }
    } catch (e) {
      alert("Failed to generate report");
    }
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
        <Text style={{ color: colors.foreground, fontSize: 18, textAlign: "center" }}>{error || "Shift not found"}</Text>
        <Text style={{ color: colors.muted, marginTop: 8 }}>Pair Code: {code}</Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary, marginTop: 24 }]} onPress={() => { setLoading(true); fetchShiftFromApi(); }}>
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
        <View style={[styles.header, { backgroundColor: isLive ? colors.success : colors.primary }]}>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{isLive ? "🔴 LIVE" : "✓ COMPLETED"}</Text>
          </View>
          <Text style={styles.siteName}>{shift.siteName}</Text>
          <Text style={styles.staffName}>{shift.staffName}</Text>
          <Text style={styles.pairCode}>Code: {shift.pairCode}</Text>
        </View>

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

        {shift.locations.length > 0 && Platform.OS === "web" && (
          <View style={styles.mapSection}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>📍 Location Trail</Text>
            <GoogleMap locations={shift.locations} isLive={isLive} />
          </View>
        )}

        {shift.locations.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Trail Points ({shift.locations.length})</Text>
            <View style={[styles.locationCard, { borderLeftColor: colors.success }]}>
              <Text style={[styles.locationLabel, { color: colors.success }]}>START</Text>
              <Text style={[styles.locationCoords, { color: colors.foreground }]}>{shift.locations[0].latitude.toFixed(6)}, {shift.locations[0].longitude.toFixed(6)}</Text>
              <Text style={[styles.locationTime, { color: colors.muted }]}>{new Date(shift.locations[0].timestamp).toLocaleString()}</Text>
              {shift.locations[0].address && <Text style={[styles.locationAddress, { color: colors.muted }]}>📍 {shift.locations[0].address}</Text>}
            </View>
            {shift.locations.length > 1 && (
              <View style={[styles.locationCard, { borderLeftColor: colors.error }]}>
                <Text style={[styles.locationLabel, { color: colors.error }]}>{isLive ? "CURRENT" : "END"}</Text>
                <Text style={[styles.locationCoords, { color: colors.foreground }]}>{shift.locations[shift.locations.length - 1].latitude.toFixed(6)}, {shift.locations[shift.locations.length - 1].longitude.toFixed(6)}</Text>
                <Text style={[styles.locationTime, { color: colors.muted }]}>{new Date(shift.locations[shift.locations.length - 1].timestamp).toLocaleString()}</Text>
                {shift.locations[shift.locations.length - 1].address && <Text style={[styles.locationAddress, { color: colors.muted }]}>📍 {shift.locations[shift.locations.length - 1].address}</Text>}
              </View>
            )}
          </View>
        )}

        {shift.photos.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>📷 Photos ({shift.photos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {shift.photos.map((photo, index) => (
                <View key={photo.id} style={styles.photoItem}>
                  {Platform.OS === "web" ? (
                    <img src={photo.uri} alt={`Photo ${index + 1}`} style={{ width: 150, height: 150, objectFit: "cover", borderRadius: 8 }} />
                  ) : (
                    <Image source={{ uri: photo.uri }} style={{ width: 150, height: 150, borderRadius: 8 }} />
                  )}
                  <Text style={[styles.photoTime, { color: colors.muted }]}>{new Date(photo.timestamp).toLocaleTimeString()}</Text>
                  {photo.address && <Text style={[styles.photoAddress, { color: colors.muted }]} numberOfLines={1}>{photo.address}</Text>}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={handleDownloadReport}>
            <Text style={styles.buttonText}>📄 Download PDF Report</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]} onPress={() => { setLoading(true); fetchShiftFromApi(); }}>
            <Text style={[styles.buttonText, { color: colors.foreground }]}>🔄 Refresh</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.lastUpdate, { color: colors.muted }]}>Last updated: {lastUpdate.toLocaleTimeString()}{isLive && " • Auto-refreshing every 10s"}</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

function GoogleMap({ locations, isLive }: { locations: LocationPoint[]; isLive: boolean }) {
  const mapId = "google-map-" + Math.random().toString(36).substr(2, 9);
  const apiKey = getGoogleMapsApiKey();

  useEffect(() => {
    if (Platform.OS !== "web" || locations.length === 0) return;

    const existingScript = document.getElementById("google-maps-script");
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = "google-maps-script";
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMap`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    (window as any).initGoogleMap = () => initMap();
    if ((window as any).google?.maps) initMap();

    function initMap() {
      const google = (window as any).google;
      if (!google?.maps) return;
      const mapContainer = document.getElementById(mapId);
      if (!mapContainer) return;

      const lats = locations.map(l => l.latitude);
      const lngs = locations.map(l => l.longitude);
      const map = new google.maps.Map(mapContainer, {
        center: { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 },
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
      });

      new google.maps.Polyline({
        path: locations.map(l => ({ lat: l.latitude, lng: l.longitude })),
        geodesic: true,
        strokeColor: "#0a7ea4",
        strokeOpacity: 1.0,
        strokeWeight: 4,
      }).setMap(map);

      new google.maps.Marker({
        position: { lat: locations[0].latitude, lng: locations[0].longitude },
        map,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: "#22c55e", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 },
        label: { text: "S", color: "#fff", fontWeight: "bold" },
      });

      if (locations.length > 1) {
        const end = locations[locations.length - 1];
        new google.maps.Marker({
          position: { lat: end.latitude, lng: end.longitude },
          map,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: isLive ? "#ef4444" : "#6366f1", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 },
          label: { text: isLive ? "●" : "E", color: "#fff", fontWeight: "bold" },
        });
      }

      const bounds = new google.maps.LatLngBounds();
      locations.forEach(loc => bounds.extend({ lat: loc.latitude, lng: loc.longitude }));
      map.fitBounds(bounds, 50);
    }
  }, [locations, isLive, mapId, apiKey]);

  if (Platform.OS !== "web") return null;
  return <div id={mapId} style={{ width: "100%", height: 350, borderRadius: 12, overflow: "hidden", marginTop: 12 }} />;
}

const styles = StyleSheet.create({
  header: { padding: 24, alignItems: "center" },
  statusBadge: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginBottom: 12 },
  statusText: { color: "white", fontWeight: "bold", fontSize: 14 },
  siteName: { color: "white", fontSize: 28, fontWeight: "bold", textAlign: "center" },
  staffName: { color: "rgba(255,255,255,0.9)", fontSize: 16, marginTop: 4 },
  pairCode: { color: "rgba(255,255,255,0.8)", fontSize: 14, marginTop: 8, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", letterSpacing: 2 },
  statsRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 20, borderBottomWidth: 1, marginHorizontal: 16 },
  stat: { alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "bold" },
  statLabel: { fontSize: 12, marginTop: 4 },
  mapSection: { padding: 16 },
  section: { margin: 16, padding: 16, borderRadius: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 12 },
  locationCard: { borderLeftWidth: 4, paddingLeft: 12, marginBottom: 12 },
  locationLabel: { fontSize: 12, fontWeight: "bold", marginBottom: 4 },
  locationCoords: { fontSize: 14, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  locationTime: { fontSize: 12, marginTop: 4 },
  locationAddress: { fontSize: 12, marginTop: 4 },
  photoItem: { marginRight: 12, width: 150 },
  photoTime: { fontSize: 12, marginTop: 4, textAlign: "center" },
  photoAddress: { fontSize: 10, textAlign: "center" },
  actions: { padding: 16, gap: 12 },
  button: { padding: 16, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "white", fontSize: 16, fontWeight: "600" },
  lastUpdate: { textAlign: "center", fontSize: 12, marginBottom: 24 },
});
