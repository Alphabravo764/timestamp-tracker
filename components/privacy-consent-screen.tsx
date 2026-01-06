import React, { useState } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Switch,
    Linking,
    Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { acceptRequiredConsents } from "@/lib/consent-storage";

interface PrivacyConsentScreenProps {
    onAccept: () => void;
    onDecline: () => void;
}

export default function PrivacyConsentScreen({
    onAccept,
    onDecline,
}: PrivacyConsentScreenProps) {
    const insets = useSafeAreaInsets();
    const [bgLocationConsent, setBgLocationConsent] = useState(true);
    const [analyticsConsent, setAnalyticsConsent] = useState(true);

    const handleAccept = async () => {
        await acceptRequiredConsents(bgLocationConsent, analyticsConsent);
        onAccept();
    };

    const openPrivacyPolicy = () => {
        Linking.openURL("https://stampia.tech/privacy");
    };

    const openTermsOfService = () => {
        Linking.openURL("https://stampia.tech/terms");
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header Icon */}
                <View style={styles.iconContainer}>
                    <LinearGradient
                        colors={["#3b82f6", "#1d4ed8"]}
                        style={styles.iconGradient}
                    >
                        <Ionicons name="shield-checkmark" size={40} color="#fff" />
                    </LinearGradient>
                </View>

                {/* Title */}
                <Text style={styles.title}>Privacy & Data Use</Text>
                <Text style={styles.subtitle}>UK GDPR Compliance</Text>

                {/* Info Card */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>What we collect during shifts:</Text>

                    <View style={styles.bulletItem}>
                        <Ionicons name="camera-outline" size={18} color="#3b82f6" />
                        <Text style={styles.bulletText}>
                            <Text style={styles.bold}>Photos</Text> – Evidence images you capture
                        </Text>
                    </View>

                    <View style={styles.bulletItem}>
                        <Ionicons name="time-outline" size={18} color="#3b82f6" />
                        <Text style={styles.bulletText}>
                            <Text style={styles.bold}>Timestamps</Text> – When actions occur
                        </Text>
                    </View>

                    <View style={styles.bulletItem}>
                        <Ionicons name="location-outline" size={18} color="#3b82f6" />
                        <Text style={styles.bulletText}>
                            <Text style={styles.bold}>Location</Text> – GPS coordinates during shifts
                        </Text>
                    </View>
                </View>

                {/* Storage Info */}
                <View style={styles.storageCard}>
                    <Ionicons name="phone-portrait-outline" size={20} color="#64748b" />
                    <Text style={styles.storageText}>
                        Data is stored on your device and may be synced to your organization's account if enabled.
                    </Text>
                </View>

                {/* Required Consents */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Required to use the app</Text>

                    <View style={styles.consentItem}>
                        <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                        <Text style={styles.consentText}>I accept the Terms of Use</Text>
                    </View>

                    <View style={styles.consentItem}>
                        <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                        <Text style={styles.consentText}>I acknowledge the Privacy Policy</Text>
                    </View>

                    <View style={styles.consentItem}>
                        <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                        <Text style={styles.consentText}>
                            I consent to processing shift evidence data
                        </Text>
                    </View>
                </View>

                {/* Optional Consents */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Optional (you can change later)</Text>

                    <View style={styles.toggleItem}>
                        <View style={styles.toggleInfo}>
                            <Ionicons name="navigate-outline" size={18} color="#64748b" />
                            <Text style={styles.toggleText}>Background location tracking</Text>
                        </View>
                        <Switch
                            value={bgLocationConsent}
                            onValueChange={setBgLocationConsent}
                            trackColor={{ false: "#e2e8f0", true: "#bfdbfe" }}
                            thumbColor={bgLocationConsent ? "#3b82f6" : "#94a3b8"}
                        />
                    </View>

                    <View style={styles.toggleItem}>
                        <View style={styles.toggleInfo}>
                            <Ionicons name="analytics-outline" size={18} color="#64748b" />
                            <Text style={styles.toggleText}>Anonymous usage analytics</Text>
                        </View>
                        <Switch
                            value={analyticsConsent}
                            onValueChange={setAnalyticsConsent}
                            trackColor={{ false: "#e2e8f0", true: "#bfdbfe" }}
                            thumbColor={analyticsConsent ? "#3b82f6" : "#94a3b8"}
                        />
                    </View>
                </View>

                {/* Links */}
                <View style={styles.linksRow}>
                    <TouchableOpacity onPress={openPrivacyPolicy}>
                        <Text style={styles.link}>Read Privacy Policy</Text>
                    </TouchableOpacity>
                    <Text style={styles.linkDivider}>•</Text>
                    <TouchableOpacity onPress={openTermsOfService}>
                        <Text style={styles.link}>Terms of Service</Text>
                    </TouchableOpacity>
                </View>

                {/* Withdraw Notice */}
                <Text style={styles.withdrawNotice}>
                    You can withdraw consent anytime in Settings, but shift tracking requires location access.
                </Text>
            </ScrollView>

            {/* Bottom Buttons */}
            <View style={[styles.bottomButtons, { paddingBottom: insets.bottom + 16 }]}>
                <TouchableOpacity style={styles.acceptButton} onPress={handleAccept}>
                    <LinearGradient
                        colors={["#22c55e", "#16a34a"]}
                        style={styles.acceptGradient}
                    >
                        <Ionicons name="checkmark" size={20} color="#fff" />
                        <Text style={styles.acceptText}>Accept & Continue</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity style={styles.declineButton} onPress={onDecline}>
                    <Text style={styles.declineText}>Decline</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8fafc",
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 40,
    },
    iconContainer: {
        alignItems: "center",
        marginBottom: 20,
    },
    iconGradient: {
        width: 80,
        height: 80,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
    },
    title: {
        fontSize: 28,
        fontWeight: "800",
        color: "#1e293b",
        textAlign: "center",
    },
    subtitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#64748b",
        textAlign: "center",
        marginTop: 4,
        marginBottom: 24,
    },
    infoCard: {
        backgroundColor: "#fff",
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: "#e2e8f0",
        marginBottom: 16,
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: "#334155",
        marginBottom: 16,
    },
    bulletItem: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        marginBottom: 12,
    },
    bulletText: {
        flex: 1,
        fontSize: 14,
        color: "#475569",
        lineHeight: 20,
    },
    bold: {
        fontWeight: "700",
        color: "#1e293b",
    },
    storageCard: {
        backgroundColor: "#f1f5f9",
        borderRadius: 16,
        padding: 16,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        marginBottom: 24,
    },
    storageText: {
        flex: 1,
        fontSize: 13,
        color: "#64748b",
        lineHeight: 18,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: "700",
        color: "#94a3b8",
        textTransform: "uppercase",
        marginBottom: 12,
    },
    consentItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: "#f0fdf4",
        padding: 14,
        borderRadius: 12,
        marginBottom: 8,
    },
    consentText: {
        flex: 1,
        fontSize: 14,
        color: "#166534",
        fontWeight: "500",
    },
    toggleItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#fff",
        padding: 14,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#e2e8f0",
    },
    toggleInfo: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        flex: 1,
    },
    toggleText: {
        fontSize: 14,
        color: "#334155",
        fontWeight: "500",
    },
    linksRow: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
    },
    link: {
        fontSize: 13,
        color: "#3b82f6",
        fontWeight: "600",
    },
    linkDivider: {
        color: "#cbd5e1",
    },
    withdrawNotice: {
        fontSize: 12,
        color: "#94a3b8",
        textAlign: "center",
        lineHeight: 18,
    },
    bottomButtons: {
        padding: 24,
        paddingTop: 16,
        backgroundColor: "#fff",
        borderTopWidth: 1,
        borderTopColor: "#f1f5f9",
    },
    acceptButton: {
        marginBottom: 12,
    },
    acceptGradient: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        paddingVertical: 18,
        borderRadius: 16,
    },
    acceptText: {
        fontSize: 16,
        fontWeight: "700",
        color: "#fff",
    },
    declineButton: {
        alignItems: "center",
        paddingVertical: 14,
    },
    declineText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#94a3b8",
    },
});
