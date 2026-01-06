import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Image, Animated } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { Shift, LocationPoint } from "@/lib/shift-types";
import { formatDuration, getShiftDuration } from "@/lib/shift-storage";
import { generatePDFReport } from "@/lib/pdf-generator";
import { getGoogleMapsApiKey } from "@/lib/google-maps";
import { getApiBaseUrl } from "@/constants/oauth";

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
    const [shift, setShift] = useState<Shift | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [pulseAnim] = useState(new Animated.Value(1));

    // Pulse animation for live indicator
    useEffect(() => {
        if (shift?.isActive) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.3,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [shift?.isActive]);

    const fetchShiftFromApi = useCallback(async () => {
        if (!code) {
            setError("No pair code provided");
            setLoading(false);
            return;
        }

        try {
            const apiUrl = getApiBaseUrl();
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
            <View style={styles.loadingContainer}>
                <View style={styles.gradient} />
                <View style={styles.loadingContent}>
                    <Text style={styles.loadingEmoji}>⏱️</Text>
                    <Text style={styles.loadingText}>Loading shift data...</Text>
                    <Text style={styles.loadingSubtext}>Pair Code: {code}</Text>
                </View>
            </View>
        );
    }

    if (error || !shift) {
        return (
            <View style={styles.errorContainer}>
                <View style={styles.gradient} />
                <View style={styles.errorContent}>
                    <Text style={styles.errorEmoji}>⚠️</Text>
                    <Text style={styles.errorTitle}>Shift Not Found</Text>
                    <Text style={styles.errorMessage}>{error || "Could not load shift data"}</Text>
                    <Text style={styles.errorCode}>Pair Code: {code}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); fetchShiftFromApi(); }}>
                        <Text style={styles.retryButtonText}>🔄 Try Again</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const duration = formatDuration(getShiftDuration(shift));
    const isLive = shift.isActive;

    return (
        <View style={{ flex: 1 }}>
            {/* Gradient Background */}
            {Platform.OS === "web" && <div style={styles.gradientWeb as any} />}
            {Platform.OS !== "web" && <View style={styles.gradient} />}

            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                {/* Hero Header with Glassmorphism */}
                <View style={[styles.heroHeader, isLive ? styles.heroLive : styles.heroCompleted]}>
                    <View style={styles.heroGlass}>
                        {/* Live Status Badge */}
                        <View style={styles.statusBadge}>
                            {isLive && (
                                <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
                            )}
                            <Text style={styles.statusText}>{isLive ? "🔴 LIVE NOW" : "✓ COMPLETED"}</Text>
                        </View>

                        {/* Site Name */}
                        <Text style={styles.siteName}>{shift.siteName}</Text>

                        {/* Staff Name */}
                        <View style={styles.staffBadge}>
                            <Text style={styles.staffIcon}>👤</Text>
                            <Text style={styles.staffName}>{shift.staffName}</Text>
                        </View>

                        {/* Pair Code */}
                        <View style={styles.pairCodeContainer}>
                            <Text style={styles.pairCodeLabel}>Pair Code:</Text>
                            <Text style={styles.pairCode}>{shift.pairCode}</Text>
                        </View>
                    </View>
                </View>

                {/* Stats Cards */}
                <View style={styles.statsContainer}>
                    <View style={[styles.statCard, styles.statCardPrimary]}>
                        <Text style={styles.statIcon}>⏱️</Text>
                        <Text style={styles.statValue}>{duration}</Text>
                        <Text style={styles.statLabel}>Duration</Text>
                    </View>

                    <View style={[styles.statCard, styles.statCardSuccess]}>
                        <Text style={styles.statIcon}>📸</Text>
                        <Text style={styles.statValue}>{shift.photos.length}</Text>
                        <Text style={styles.statLabel}>Photos</Text>
                    </View>

                    <View style={[styles.statCard, styles.statCardInfo]}>
                        <Text style={styles.statIcon}>📍</Text>
                        <Text style={styles.statValue}>{shift.locations.length}</Text>
                        <Text style={styles.statLabel}>Locations</Text>
                    </View>
                </View>

                {/* Map Section */}
                {shift.locations.length > 0 && Platform.OS === "web" && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionIcon}>🗺️</Text>
                            <Text style={styles.sectionTitle}>Location Trail</Text>
                        </View>
                        <View style={styles.mapContainer}>
                            <GoogleMap locations={shift.locations} isLive={isLive} />
                        </View>
                    </View>
                )}

                {/* Timeline Section */}
                {shift.locations.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionIcon}>📌</Text>
                            <Text style={styles.sectionTitle}>Trail Points ({shift.locations.length})</Text>
                        </View>

                        {/* Start Location */}
                        <View style={[styles.timelineCard, styles.timelineStart]}>
                            <View style={[styles.timelineDot, styles.timelineStartDot]} />
                            <View style={styles.timelineContent}>
                                <Text style={styles.timelineLabel}>START</Text>
                                <Text style={styles.timelineCoords}>
                                    {shift.locations[0].latitude.toFixed(6)}, {shift.locations[0].longitude.toFixed(6)}
                                </Text>
                                <Text style={styles.timelineTime}>{new Date(shift.locations[0].timestamp).toLocaleString()}</Text>
                                {shift.locations[0].address && (
                                    <Text style={styles.timelineAddress}>📍 {shift.locations[0].address}</Text>
                                )}
                            </View>
                        </View>

                        {/* End/Current Location */}
                        {shift.locations.length > 1 && (
                            <View style={[styles.timelineCard, isLive ? styles.timelineCurrent : styles.timelineEnd]}>
                                <View style={[styles.timelineDot, isLive ? styles.timelineCurrentDot : styles.timelineEndDot]} />
                                <View style={styles.timelineContent}>
                                    <Text style={styles.timelineLabel}>{isLive ? "CURRENT" : "END"}</Text>
                                    <Text style={styles.timelineCoords}>
                                        {shift.locations[shift.locations.length - 1].latitude.toFixed(6)}, {shift.locations[shift.locations.length - 1].longitude.toFixed(6)}
                                    </Text>
                                    <Text style={styles.timelineTime}>{new Date(shift.locations[shift.locations.length - 1].timestamp).toLocaleString()}</Text>
                                    {shift.locations[shift.locations.length - 1].address && (
                                        <Text style={styles.timelineAddress}>📍 {shift.locations[shift.locations.length - 1].address}</Text>
                                    )}
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {/* Photos Gallery */}
                {shift.photos.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionIcon}>📷</Text>
                            <Text style={styles.sectionTitle}>Photo Gallery ({shift.photos.length})</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoGallery}>
                            {shift.photos.map((photo, index) => (
                                <View key={photo.id} style={styles.photoCard}>
                                    {Platform.OS === "web" ? (
                                        <img src={photo.uri} alt={`Photo ${index + 1}`} style={styles.photoImageWeb as any} />
                                    ) : (
                                        <Image source={{ uri: photo.uri }} style={styles.photoImage} />
                                    )}
                                    <View style={styles.photoOverlay}>
                                        <Text style={styles.photoNumber}>#{index + 1}</Text>
                                        <Text style={styles.photoTime}>{new Date(photo.timestamp).toLocaleTimeString()}</Text>
                                    </View>
                                    {photo.address && (
                                        <Text style={styles.photoAddress} numberOfLines={2}>{photo.address}</Text>
                                    )}
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.primaryButton} onPress={handleDownloadReport}>
                        <Text style={styles.buttonIcon}>📄</Text>
                        <Text style={styles.buttonText}>Download PDF Report</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.secondaryButton} onPress={() => { setLoading(true); fetchShiftFromApi(); }}>
                        <Text style={styles.buttonIcon}>🔄</Text>
                        <Text style={[styles.buttonText, styles.secondaryButtonText]}>Refresh Data</Text>
                    </TouchableOpacity>
                </View>

                {/* Auto-refresh indicator */}
                <Text style={styles.footer}>
                    Last updated: {lastUpdate.toLocaleTimeString()}
                    {isLive && " • Auto-refreshing every 10s"}
                </Text>

                {/*Branding Footer */}
                <View style={styles.brandingFooter}>
                    <Text style={styles.brandingText}>Powered by Timestamp Tracker</Text>
                </View>
            </ScrollView>
        </View>
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
                styles: [
                    { featureType: "water", elementType: "geometry", stylers: [{ color: "#667eea" }] },
                    { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
                ],
            });

            new google.maps.Polyline({
                path: locations.map(l => ({ lat: l.latitude, lng: l.longitude })),
                geodesic: true,
                strokeColor: "#667eea",
                strokeOpacity: 1.0,
                strokeWeight: 4,
            }).setMap(map);

            new google.maps.Marker({
                position: { lat: locations[0].latitude, lng: locations[0].longitude },
                map,
                icon: { path: google.maps.SymbolPath.CIRCLE, scale: 12, fillColor: "#22c55e", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 },
                label: { text: "S", color: "#fff", fontWeight: "bold" },
            });

            if (locations.length > 1) {
                const end = locations[locations.length - 1];
                new google.maps.Marker({
                    position: { lat: end.latitude, lng: end.longitude },
                    map,
                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 12, fillColor: isLive ? "#ef4444" : "#667eea", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 },
                    label: { text: isLive ? "●" : "E", color: "#fff", fontWeight: "bold" },
                });
            }

            const bounds = new google.maps.LatLngBounds();
            locations.forEach(loc => bounds.extend({ lat: loc.latitude, lng: loc.longitude }));
            map.fitBounds(bounds, 50);
        }
    }, [locations, isLive, mapId, apiKey]);

    if (Platform.OS !== "web") return null;
    return <div id={mapId} style={{ width: "100%", height: 400, borderRadius: 16, overflow: "hidden" }} />;
}

const styles = StyleSheet.create({
    // Loading & Error States
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f0f1e" },
    loadingContent: { alignItems: "center", zIndex: 1 },
    loadingEmoji: { fontSize: 64, marginBottom: 20 },
    loadingText: { color: "#fff", fontSize: 20, fontWeight: "600", marginBottom: 8 },
    loadingSubtext: { color: "rgba(255,255,255,0.6)", fontSize: 14 },

    errorContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f0f1e", padding: 24 },
    errorContent: { alignItems: "center", zIndex: 1, maxWidth: 400 },
    errorEmoji: { fontSize: 64, marginBottom: 20 },
    errorTitle: { color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 12, textAlign: "center" },
    errorMessage: { color: "rgba(255,255,255,0.8)", fontSize: 16, marginBottom: 8, textAlign: "center" },
    errorCode: { color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 24 },
    retryButton: { backgroundColor: "rgba(102,126,234,0.2)", paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, borderWidth: 2, borderColor: "#667eea" },
    retryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },

    // Main Container
    container: { flex: 1 },
    gradient: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#667eea", zIndex: 0 },
    gradientWeb: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", zIndex: 0 },

    // Hero Header
    heroHeader: { paddingTop: 60, paddingBottom: 40, paddingHorizontal: 20 },
    heroLive: {},
    heroComplete: {},
    heroGlass: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 24, padding: 24, alignItems: "center" },

    statusBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginBottom: 16 },
    liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ff4444", marginRight: 8 },
    statusText: { color: "#fff", fontWeight: "bold", fontSize: 14, letterSpacing: 1 },

    siteName: { color: "#fff", fontSize: 32, fontWeight: "bold", textAlign: "center", marginBottom: 12 },

    staffBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 16, marginBottom: 12 },
    staffIcon: { fontSize: 18, marginRight: 8 },
    staffName: { color: "#fff", fontSize: 18, fontWeight: "600" },

    pairCodeContainer: { flexDirection: "row", alignItems: "center", marginTop: 8 },
    pairCodeLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, marginRight: 8 },
    pairCode: { color: "#fff", fontSize: 18, fontWeight: "bold", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", letterSpacing: 2 },

    // Stats Cards
    statsContainer: { flexDirection: "row", paddingHorizontal: 20, marginTop: -20, marginBottom: 24, gap: 12 },
    statCard: { flex: 1, backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 16, padding: 16, alignItems: "center" },
    statCardPrimary: { borderLeftWidth: 4, borderLeftColor: "#667eea" },
    statCardSuccess: { borderLeftWidth: 4, borderLeftColor: "#22c55e" },
    statCardInfo: { borderLeftWidth: 4, borderLeftColor: "#3b82f6" },
    statIcon: { fontSize: 32, marginBottom: 8 },
    statValue: { fontSize: 24, fontWeight: "bold", color: "#1f2937", marginBottom: 4 },
    statLabel: { fontSize: 12, textAlign: "center", fontWeight: "600", color: "#6b7280" },

    // Sections
    section: { marginHorizontal: 20, marginBottom: 24, backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 16, padding: 20 },
    sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
    sectionIcon: { fontSize: 24, marginRight: 8 },
    sectionTitle: { fontSize: 20, fontWeight: "bold", color: "#1f2937" },

    // Map
    mapContainer: { borderRadius: 12, overflow: "hidden", marginTop: 12 },

    // Timeline
    timelineCard: { borderLeftWidth: 4, paddingLeft: 16, marginBottom: 16, position: "relative" },
    timelineStart: { borderLeftColor: "#22c55e" },
    timelineEnd: { borderLeftColor: "#667eea" },
    timelineCurrent: { borderLeftColor: "#ef4444" },
    timelineDot: { position: "absolute", left: -6, top: 4, width: 12, height: 12, borderRadius: 6, backgroundColor: "#fff", borderWidth: 3 },
    timelineStartDot: { borderColor: "#22c55e" },
    timelineEndDot: { borderColor: "#667eea" },
    timelineCurrentDot: { borderColor: "#ef4444" },
    timelineContent: { paddingLeft: 8 },
    timelineLabel: { fontSize: 12, fontWeight: "bold", color: "#6b7280", marginBottom: 4, letterSpacing: 1 },
    timelineCoords: { fontSize: 14, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", color: "#1f2937", marginBottom: 4 },
    timelineTime: { fontSize: 13, color: "#6b7280", marginBottom: 4 },
    timelineAddress: { fontSize: 12, color: "#9ca3af", marginTop: 4 },

    // Photo Gallery
    photoGallery: { marginTop: 12 },
    photoCard: { width: 200, marginRight: 16, backgroundColor: "#f9fafb", borderRadius: 12, overflow: "hidden" },
    photoImage: { width: 200, height: 200 },
    photoImageWeb: { width: 200, height: 200, objectFit: "cover" },
    photoOverlay: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
    photoNumber: { color: "#fff", fontSize: 12, fontWeight: "bold" },
    photoTime: { color: "#fff", fontSize: 11 },
    photoAddress: { padding: 12, fontSize: 12, color: "#6b7280" },

    // Actions
    actions: { marginHorizontal: 20, marginBottom: 16, gap: 12 },
    primaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#667eea", paddingVertical: 16, borderRadius: 12 },
    secondaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.95)", paddingVertical: 16, borderRadius: 12, borderWidth: 2, borderColor: "#e5e7eb" },
    buttonIcon: { fontSize: 18, marginRight: 8 },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    secondaryButtonText: { color: "#1f2937" },

    // Footer
    footer: { textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 8, paddingHorizontal: 20 },
    brandingFooter: { paddingVertical: 20, alignItems: "center" },
    brandingText: { color: "rgba(255,255,255,0.6)", fontSize: 12 },
});
