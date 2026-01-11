
import { useState, useCallback, useEffect } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    TextInput,
    ScrollView,
    Alert,
    Dimensions,
    ActivityIndicator,
    Animated,
    Modal,
    Image
} from "react-native";
import { useFocusEffect, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import {
    startShift as startLocalShift,
    getActiveShift as getLocalActiveShift,
} from "@/lib/shift-storage";
import { getTemplates, useTemplate, type ShiftTemplate } from "@/lib/shift-templates";
import { syncShiftStart } from "@/lib/server-sync";
import ActiveShiftScreen from "../shift/active";
import { getSettings, canStartShift, incrementShiftCount, TRIAL_LIMITS, getPremiumStatus, PremiumStatus } from "@/lib/settings-storage";
import { useColors } from "@/hooks/use-colors";
import StampiaLogo from "@/components/stampia-logo";

export default function HomeScreen() {
    const colors = useColors();
    const insets = useSafeAreaInsets();
    const [activeShift, setActiveShift] = useState<any | null>(null);
    const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
    const [showStartForm, setShowStartForm] = useState(false);
    const [isPremium, setIsPremium] = useState(false);

    // Form State
    const [siteName, setSiteName] = useState("");
    const [staffName, setStaffName] = useState("");
    const [loading, setLoading] = useState(false);
    const [currentAddress, setCurrentAddress] = useState("Locating...");

    // Pre-fill Staff Name and check premium status
    useEffect(() => {
        getSettings().then(settings => {
            if (settings.userName) {
                setStaffName(settings.userName);
            }
        });
        getPremiumStatus().then(status => {
            setIsPremium(status.isPremium);
        });
    }, []);

    // Check for active shift
    const checkActiveShift = useCallback(async () => {
        const localShift = await getLocalActiveShift();
        if (localShift && localShift.isActive) {
            setActiveShift(localShift);
        } else {
            setActiveShift(null);
        }
    }, []);

    const loadTemplates = async () => {
        const temps = await getTemplates();
        setTemplates(temps);
    };

    // Cached location for instant access
    const [cachedLocation, setCachedLocation] = useState<Location.LocationObject | null>(null);

    const getLocation = async () => {
        try {
            const { status } = await Location.getForegroundPermissionsAsync();
            if (status !== 'granted') {
                setCurrentAddress("Tap to enable location");
                return;
            }

            // INSTANT: Try last known position first (no network required)
            const lastKnown = await Location.getLastKnownPositionAsync({});
            if (lastKnown) {
                setCachedLocation(lastKnown);
                // Show coordinates immediately
                setCurrentAddress(`${lastKnown.coords.latitude.toFixed(4)}, ${lastKnown.coords.longitude.toFixed(4)}`);

                // Background geocode (don't await)
                Location.reverseGeocodeAsync({
                    latitude: lastKnown.coords.latitude,
                    longitude: lastKnown.coords.longitude
                }).then(([address]) => {
                    if (address) {
                        const addrStr = [address.street, address.city].filter(Boolean).join(", ");
                        if (addrStr) setCurrentAddress(addrStr);
                    }
                }).catch(() => { });
            }

            // Background: Try to get fresh location (non-blocking)
            // Use very short timeout, we already have last known
            Promise.race([
                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000))
            ]).then((freshLoc) => {
                if (freshLoc && freshLoc.coords) {
                    setCachedLocation(freshLoc as Location.LocationObject);
                    setCurrentAddress(`${freshLoc.coords.latitude.toFixed(4)}, ${freshLoc.coords.longitude.toFixed(4)}`);
                    // Background geocode for fresh position
                    Location.reverseGeocodeAsync({
                        latitude: freshLoc.coords.latitude,
                        longitude: freshLoc.coords.longitude
                    }).then(([address]) => {
                        if (address) {
                            const addrStr = [address.street, address.city].filter(Boolean).join(", ");
                            if (addrStr) setCurrentAddress(addrStr);
                        }
                    }).catch(() => { });
                }
            }).catch(() => { });

            // If no last known, show getting location briefly
            if (!lastKnown) {
                setCurrentAddress("Getting location...");
            }
        } catch (e) {
            setCurrentAddress("Location unavailable");
        }
    };

    useFocusEffect(
        useCallback(() => {
            checkActiveShift();
            loadTemplates();
            getLocation();
        }, [])
    );

    // Hooks must always run. Do not return early.
    // We will handle the conditional render in the main return block.

    // Pre-load location when form opens
    useEffect(() => {
        if (showStartForm) {
            getLocation();
        }
    }, [showStartForm]);

    const handleStartShift = async () => {
        if (!siteName.trim()) {
            Alert.alert("Required", "Please enter a site name");
            return;
        }

        // Check trial limits
        const { allowed, remaining } = await canStartShift();
        if (!allowed) {
            Alert.alert(
                "Trial Limit Reached",
                "You've reached the trial limit for shifts.\nPremium options are coming soon.",
                [{ text: "Got it" }]
            );
            return;
        }

        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
            const permissionResponse = await Location.requestForegroundPermissionsAsync();
            if (permissionResponse.status !== 'granted') {
                Alert.alert("Permission Denied", "Location is required.");
                return;
            }
        }

        setLoading(true);
        try {
            // INSTANT: Use cached location if available (already fetched when form opened)
            let location = cachedLocation;

            // If no cached location, try last known (instant, no network)
            if (!location) {
                location = await Location.getLastKnownPositionAsync({});
            }

            // Only if still no location, try quick fresh fetch with very short timeout
            if (!location) {
                try {
                    location = await Promise.race([
                        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
                        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))
                    ]) as Location.LocationObject | null;
                } catch {
                    location = null;
                }
            }

            // Fallback to zero coords if absolutely nothing available
            const coords = location?.coords || { latitude: 0, longitude: 0, accuracy: 0 };

            const shift = await startLocalShift(staffName, siteName, {
                latitude: coords.latitude,
                longitude: coords.longitude,
                accuracy: coords.accuracy ?? 0,
                timestamp: new Date().toISOString()
            });

            // Sync shift to Railway server (for live tracking)
            // Try up to 3 times with exponential backoff
            const syncWithRetry = async (retries = 3): Promise<boolean> => {
                for (let i = 0; i < retries; i++) {
                    try {
                        console.log(`[SYNC] Attempting to sync shift to server (attempt ${i + 1}/${retries})...`);
                        const result = await syncShiftStart(shift);
                        console.log('[SYNC] Shift synced successfully:', result);
                        return true;
                    } catch (err: any) {
                        console.error(`[SYNC] Sync attempt ${i + 1} failed:`, err?.message || err);
                        if (i < retries - 1) {
                            // Wait before retrying (1s, 2s, 4s)
                            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
                        }
                    }
                }
                return false;
            };

            // Wait for sync and show result to user
            syncWithRetry().then(success => {
                if (success) {
                    console.log('[SYNC] ✅ Shift synced - live tracking is active');
                } else {
                    console.warn('[SYNC] ❌ Failed to sync shift after 3 attempts');
                    Alert.alert(
                        "Sync Failed",
                        "Could not sync to server. Live tracking won't work, but photos are saved locally.",
                        [{ text: "OK" }]
                    );
                }
            });

            if (Platform.OS !== "web") {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            setSiteName("");
            setShowStartForm(false);
            setActiveShift(shift);

            // Increment trial usage counter
            await incrementShiftCount();

        } catch (e: any) {
            Alert.alert("Error", e.message);
        } finally {
            setLoading(false);
        }
    };

    const selectTemplate = (t: ShiftTemplate) => {
        setSiteName(t.siteName);
        setStaffName(t.staffName);
        useTemplate(t.id);
    };

    // Start Shift Form Modal or Main Dashboard
    // We handle the return logic at the end to ensure hooks pass

    // Main Render Logic

    // 1. Active Shift View
    if (activeShift) {
        return <ActiveShiftScreen onShiftEnd={() => setActiveShift(null)} />;
    }

    // 2. Main Dashboard (OFF DUTY VIEW) with Modal Popup
    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: colors.background }]}>

            {/* Top Bar */}
            <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={[styles.offDutyBadge, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                        <View style={styles.statusDot} />
                        <Text style={[styles.offDutyText, { color: colors.muted }]}>OFF DUTY</Text>
                    </View>
                    {isPremium ? (
                        <View style={{ backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#22c55e' }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#166534' }}>✓ PREMIUM</Text>
                        </View>
                    ) : (
                        <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#fbbf24' }}>
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#92400e' }}>⚠️ TRIAL</Text>
                        </View>
                    )}
                </View>
                <TouchableOpacity
                    style={[styles.settingsButton, { backgroundColor: colors.surface }]}
                    onPress={() => router.push("/(tabs)/settings")}
                >
                    <Ionicons name="settings-outline" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* Center Content */}
            <View style={styles.centerContent}>

                {/* Welcome Header */}
                <View style={styles.welcomeSection}>
                    <View style={[styles.userIconCircle, { backgroundColor: colors.primary + '10' }]}>
                        <StampiaLogo size={50} color={colors.primary} />
                    </View>
                    <Text style={[styles.welcomeTitle, { color: colors.text }]}>STAMPIA</Text>
                    <Text style={styles.welcomeSubtitle}>Proof of Presence</Text>
                </View>

                {/* GIANT START BUTTON */}
                <View style={styles.startButtonContainer}>
                    {/* Pulse Rings - Blue */}
                    <View style={[styles.pulseRing, { transform: [{ scale: 1.2 }], opacity: 0.3, backgroundColor: colors.primary }]} />
                    <View style={[styles.pulseRing, { transform: [{ scale: 1.5 }], opacity: 0.1, backgroundColor: colors.primary }]} />

                    <TouchableOpacity
                        style={[styles.giantStartButton, { backgroundColor: colors.primary, borderColor: "#fff", borderWidth: 4 }]}
                        onPress={() => {
                            getLocation();
                            setShowStartForm(true);
                        }}
                        activeOpacity={0.9}
                    >
                        <Ionicons name="play" size={64} color="#fff" style={{ marginLeft: 6 }} />
                        <Text style={styles.giantButtonText}>Start Shift</Text>
                    </TouchableOpacity>
                </View>

                {/* Footer Info */}
                <View style={styles.footerInfo}>
                    <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#2563eb" />
                        <Text style={styles.verifiedText}>VERIFIED PROVIDER</Text>
                    </View>
                    <Text style={styles.footerTagline}>PROUD TIMESTAMP PROVIDER • SECURE & VERIFIED</Text>
                </View>

            </View>

            {/* START SHIFT MODAL POPUP */}
            <Modal
                visible={showStartForm}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowStartForm(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowStartForm(false)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        style={[styles.modalContent, { backgroundColor: colors.surface }]}
                        onPress={() => { }} // Prevent closing when tapping inside
                    >
                        {/* Modal Header */}
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text }]}>Start New Shift</Text>
                            <TouchableOpacity onPress={() => setShowStartForm(false)}>
                                <Ionicons name="close" size={24} color={colors.muted} />
                            </TouchableOpacity>
                        </View>

                        {/* Recent Sites */}
                        {templates.length > 0 && (
                            <View style={styles.modalSection}>
                                <Text style={[styles.modalLabel, { color: colors.muted }]}>Recent Sites</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    {templates.map(t => (
                                        <TouchableOpacity
                                            key={t.id}
                                            style={[styles.templateChip, { backgroundColor: colors.background }]}
                                            onPress={() => selectTemplate(t)}
                                        >
                                            <Text style={[styles.templateText, { color: colors.text }]}>{t.siteName}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Site Name Input */}
                        <View style={styles.modalSection}>
                            <Text style={[styles.modalLabel, { color: colors.muted }]}>Site Name *</Text>
                            <View style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                <Ionicons name="business-outline" size={18} color={colors.muted} />
                                <TextInput
                                    style={[styles.modalInputText, { color: colors.text }]}
                                    value={siteName}
                                    onChangeText={setSiteName}
                                    placeholder="e.g. Headquarters"
                                    placeholderTextColor={colors.muted}
                                    autoFocus
                                />
                            </View>
                        </View>

                        {/* Staff Name Input */}
                        <View style={styles.modalSection}>
                            <Text style={[styles.modalLabel, { color: colors.muted }]}>Staff Name</Text>
                            <View style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                <Ionicons name="person-outline" size={18} color={colors.muted} />
                                <TextInput
                                    style={[styles.modalInputText, { color: colors.text }]}
                                    value={staffName}
                                    onChangeText={setStaffName}
                                    placeholder="Optional"
                                    placeholderTextColor={colors.muted}
                                />
                            </View>
                        </View>

                        {/* Location Preview */}
                        <View style={[styles.modalLocation, { backgroundColor: colors.primary + '15' }]}>
                            <Ionicons name="location" size={16} color={colors.primary} />
                            <Text style={[styles.modalLocationText, { color: colors.primary }]}>{currentAddress}</Text>
                        </View>

                        {/* OK Button */}
                        <TouchableOpacity
                            style={[styles.modalOkButton, loading && { opacity: 0.7 }]}
                            onPress={handleStartShift}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.modalOkButtonText}>OK - Start Shift</Text>
                            )}
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
        backgroundColor: '#fff',
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    offDutyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 8,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#94a3b8',
    },
    offDutyText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
        letterSpacing: 0.5,
    },
    settingsButton: {
        width: 44,
        height: 44,
        backgroundColor: '#f8fafc',
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    welcomeSection: {
        alignItems: 'center',
        marginBottom: 48,
    },
    userIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#eff6ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
    },
    welcomeTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: '#0f172a',
        marginBottom: 8,
        letterSpacing: -1,
    },
    welcomeSubtitle: {
        fontSize: 18,
        color: '#94a3b8',
        fontWeight: '500',
    },
    startButtonContainer: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 64,
    },
    pulseRing: {
        position: 'absolute',
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: '#dbeafe',
        zIndex: -1,
    },
    giantStartButton: {
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: '#2563eb',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.4,
        shadowRadius: 30,
        elevation: 20,
        borderWidth: 8,
        borderColor: '#fff',
    },
    giantButtonText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
        marginTop: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    footerInfo: {
        alignItems: 'center',
        gap: 12,
        opacity: 0.8,
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#eff6ff',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    verifiedText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#2563eb',
        letterSpacing: 0.5,
    },
    footerTagline: {
        fontSize: 10,
        fontWeight: '700',
        color: '#cbd5e1',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },

    // Form Styles
    formHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    formTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
    },
    formContent: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 24,
    },
    templatesSection: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748b',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    templateChip: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        marginRight: 8,
    },
    templateText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1e293b',
    },
    inputGroup: {
        marginBottom: 20,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 16,
        gap: 12,
    },
    input: {
        flex: 1,
        height: 52,
        fontSize: 16,
        color: '#1e293b',
    },
    locationPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#eff6ff',
        padding: 12,
        borderRadius: 12,
        marginTop: 8,
    },
    locationPreviewText: {
        fontSize: 13,
        color: '#3b82f6',
        fontWeight: '500',
    },
    formFooter: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bigRedButton: {
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: '#dc2626',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#dc2626',
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.4,
        shadowRadius: 25,
        elevation: 15,
        borderWidth: 6,
        borderColor: '#fff',
    },
    bigRedButtonText: {
        fontSize: 20,
        fontWeight: '900',
        color: '#fff',
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    submitButton: {
        backgroundColor: '#1e293b',
        borderRadius: 20, // Increased radius
        height: 88, // Increased height from 72
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        gap: 16,
    },
    submitIconBox: {
        width: 56, // Increased from 44
        height: 56, // Increased from 44
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitButtonText: {
        fontSize: 22, // Increased from 18
        fontWeight: '900',
        color: '#fff',
        letterSpacing: 1,
    },
    submitButtonSubtext: {
        fontSize: 14, // Increased from 11
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '600',
    },
    // Modal Popup Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalContent: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    modalSection: {
        marginBottom: 16,
    },
    modalLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    modalInput: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        gap: 10,
    },
    modalInputText: {
        flex: 1,
        height: 48,
        fontSize: 16,
    },
    modalLocation: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 10,
        marginBottom: 20,
    },
    modalLocationText: {
        fontSize: 13,
        fontWeight: '500',
        flex: 1,
    },
    modalOkButton: {
        backgroundColor: '#dc2626',
        borderRadius: 14,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalOkButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
});
