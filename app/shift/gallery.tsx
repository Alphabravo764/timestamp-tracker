import { useState, useEffect, useRef } from "react";
import {
    Share,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Image,
    Modal,
    Dimensions,
    Alert,
    ActivityIndicator,
    Platform
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { GradientBackground } from "@/components/gradient-background";
import { Ionicons } from "@expo/vector-icons";
import { getActiveShift } from "@/lib/shift-storage";
import ViewShot, { captureRef } from "react-native-view-shot";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function GalleryScreen() {
    const [photos, setPhotos] = useState<any[]>([]);
    const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);
    const [sharing, setSharing] = useState(false);
    const viewShotRef = useRef<ViewShot>(null);

    useEffect(() => {
        loadPhotos();
    }, []);

    const loadPhotos = async () => {
        const shift = await getActiveShift();
        if (shift && shift.photos) {
            setPhotos(shift.photos.reverse());
        }
    };

    const handleShare = async () => {
        if (!selectedPhoto || !viewShotRef.current) return;
        setSharing(true);
        try {
            // Burn the watermark by capturing the view
            const uri = await captureRef(viewShotRef, {
                format: "jpg",
                quality: 0.9,
                result: "tmpfile"
            });

            // Platform-specific sharing
            if (Platform.OS === 'ios') {
                await Share.share({
                    url: uri,
                });
            } else {
                // Android - use expo-sharing for proper image sharing
                const Sharing = require('expo-sharing');
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'image/jpeg',
                        dialogTitle: 'Share Evidence Photo'
                    });
                } else {
                    Alert.alert("Error", "Sharing is not available on this device");
                }
            }
        } catch (e) {
            Alert.alert("Error", "Failed to share image");
            console.error(e);
        } finally {
            setSharing(false);
        }
    };

    return (
        <GradientBackground variant="dark">
            <ScreenContainer>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Gallery ({photos.length})</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {photos.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="images-outline" size={64} color="rgba(255,255,255,0.2)" />
                            <Text style={styles.emptyText}>No photos yet</Text>
                        </View>
                    ) : (
                        <View style={styles.grid}>
                            {photos.map((photo) => (
                                <TouchableOpacity
                                    key={photo.id}
                                    style={styles.gridItem}
                                    onPress={() => setSelectedPhoto(photo)}
                                >
                                    <Image source={{ uri: photo.uri }} style={styles.image} />
                                    <View style={styles.overlay}>
                                        <Text style={styles.timestamp}>
                                            {new Date(photo.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </ScrollView>

                {/* Full Screen Modal */}
                <Modal visible={!!selectedPhoto} transparent={true} animationType="fade">
                    <View style={styles.modalContainer}>
                        <TouchableOpacity
                            style={styles.modalClose}
                            onPress={() => setSelectedPhoto(null)}
                        >
                            <Ionicons name="close" size={32} color="#fff" />
                        </TouchableOpacity>

                        {/* Capture Container (This is what gets burned) */}
                        {selectedPhoto && (
                            <View style={styles.previewContainer}>
                                <ViewShot ref={viewShotRef} style={{ flex: 1, backgroundColor: '#000' }} options={{ format: "jpg", quality: 0.9 }}>
                                    <View style={{ flex: 1, justifyContent: 'center' }}>
                                        <Image
                                            source={{ uri: selectedPhoto.uri }}
                                            style={styles.modalImage}
                                            resizeMode="contain"
                                        />
                                        {/* Overlay Watermark */}
                                        <View style={styles.watermarkOverlay}>
                                            <View style={styles.wmRow}>
                                                <Ionicons name="time" size={14} color="#fcd34d" style={{ marginRight: 6 }} />
                                                <Text style={styles.wmTextBold}>
                                                    {new Date(selectedPhoto.timestamp).toLocaleString()}
                                                </Text>
                                            </View>

                                            {selectedPhoto.address && (
                                                <View style={styles.wmRow}>
                                                    <Ionicons name="location" size={14} color="#fca5a5" style={{ marginRight: 6 }} />
                                                    <Text style={styles.wmText}>
                                                        {selectedPhoto.address}
                                                    </Text>
                                                </View>
                                            )}

                                            {selectedPhoto.location && (
                                                <View style={styles.wmRow}>
                                                    <Ionicons name="compass" size={14} color="#93c5fd" style={{ marginRight: 6 }} />
                                                    <Text style={styles.wmTextSmall}>
                                                        {selectedPhoto.location.latitude.toFixed(6)}, {selectedPhoto.location.longitude.toFixed(6)}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </ViewShot>
                            </View>
                        )}

                        {/* Share Button (Outside capture area) */}
                        <TouchableOpacity
                            style={styles.shareButton}
                            onPress={handleShare}
                            disabled={sharing}
                        >
                            {sharing ? (
                                <ActivityIndicator color="#0f172a" />
                            ) : (
                                <>
                                    <Ionicons name="share-outline" size={24} color="#0f172a" />
                                    <Text style={styles.shareButtonText}>Share Evidence</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </Modal>

            </ScreenContainer>
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20 },
    backButton: { width: 40, height: 40, justifyContent: "center", borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center" },
    headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
    scrollContent: { padding: 20 },
    emptyState: { alignItems: "center", justifyContent: "center", marginTop: 100 },
    emptyText: { color: "rgba(255,255,255,0.4)", marginTop: 16, fontSize: 16 },

    grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    gridItem: { width: (SCREEN_WIDTH - 48) / 3, height: (SCREEN_WIDTH - 48) / 3, borderRadius: 12, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.1)" },
    image: { width: "100%", height: "100%" },
    overlay: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)", padding: 4 },
    timestamp: { color: "#fff", fontSize: 10, textAlign: "center", fontWeight: "600" },

    modalContainer: { flex: 1, backgroundColor: "#000", justifyContent: "center" },
    modalClose: { position: "absolute", top: 40, right: 20, zIndex: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 24 },
    previewContainer: { flex: 1 },
    modalImage: { width: "100%", height: "100%", backgroundColor: '#000' },

    // Watermark Styles - positioned at TOP
    watermarkOverlay: {
        position: "absolute",
        top: 60,
        left: 20,
        right: 20,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        padding: 16,
        borderRadius: 12,
        alignItems: 'flex-start',
        borderLeftWidth: 4,
        borderLeftColor: '#ef4444'
    },
    wmRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    wmTextBold: { color: "#fff", fontSize: 16, fontWeight: "bold", textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2 },
    wmText: { color: "#e2e8f0", fontSize: 14, fontWeight: "500", lineHeight: 20 },
    wmTextSmall: { color: "#cbd5e1", fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

    shareButton: {
        position: 'absolute',
        bottom: 40,
        alignSelf: 'center',
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 30,
        gap: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        zIndex: 20
    },
    shareButtonText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 }
});
