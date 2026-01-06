import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking, Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { getApiBaseUrl } from "@/constants/oauth";
import {
    acceptRequiredConsents,
    getConsentData,
    hasAcceptedCurrentPolicy,
    saveConsentData,
    withdrawConsent as storageWithdrawConsent,
    type ConsentData
} from "@/lib/consent-storage";

interface ConsentScreenProps {
    onConsent: () => void;
}

export function ConsentScreen({ onConsent }: ConsentScreenProps) {
    const colors = useColors();
    const [accepted, setAccepted] = useState(false);
    const [bgLocation, setBgLocation] = useState(false);
    const [analytics, setAnalytics] = useState(true);

    const openPrivacyPolicy = () => {
        const url = `${getApiBaseUrl()}/privacy-policy`;
        if (Platform.OS === "web") {
            window.open(url, "_blank");
        } else {
            Linking.openURL(url);
        }
    };

    const openTerms = () => {
        const url = `${getApiBaseUrl()}/terms-of-service`;
        if (Platform.OS === "web") {
            window.open(url, "_blank");
        } else {
            Linking.openURL(url);
        }
    };

    const handleAccept = async () => {
        if (!accepted) {
            alert("Please check the box to agree to the Privacy Policy and Terms of Service");
            return;
        }

        try {
            await acceptRequiredConsents(bgLocation, analytics);
            onConsent();
        } catch (error) {
            console.error("Error saving consent:", error);
            alert("Failed to save consent. Please try again.");
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.logo}>⏱️</Text>
                    <Text style={[styles.title, { color: colors.foreground }]}>Welcome to Timestamp Tracker</Text>
                    <Text style={[styles.subtitle, { color: colors.muted }]}>
                        Professional shift tracking with location and photo verification
                    </Text>
                </View>

                {/* What we collect */}
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                        📋 What we collect during your shifts:
                    </Text>

                    <View style={styles.bulletPoint}>
                        <Text style={styles.bullet}>📍</Text>
                        <Text style={[styles.bulletText, { color: colors.foreground }]}>
                            Your GPS location to track your route and verify your presence
                        </Text>
                    </View>

                    <View style={styles.bulletPoint}>
                        <Text style={styles.bullet}>📸</Text>
                        <Text style={[styles.bulletText, { color: colors.foreground }]}>
                            Photos you capture with timestamps and location watermarks
                        </Text>
                    </View>
                </View>

                {/* Optional Consents */}
                <View style={[styles.section, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                        ⚙️ Optional Permissions:
                    </Text>

                    {/* Bg Location */}
                    <TouchableOpacity
                        style={styles.optionRow}
                        onPress={() => setBgLocation(!bgLocation)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.checkboxBox, { borderColor: colors.border, backgroundColor: bgLocation ? colors.primary : "transparent" }]}>
                            {bgLocation && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.optionTitle, { color: colors.foreground }]}>Background Location</Text>
                            <Text style={[styles.optionDesc, { color: colors.muted }]}>Track shift route even when app is closed</Text>
                        </View>
                    </TouchableOpacity>

                    {/* Analytics */}
                    <TouchableOpacity
                        style={styles.optionRow}
                        onPress={() => setAnalytics(!analytics)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.checkboxBox, { borderColor: colors.border, backgroundColor: analytics ? colors.primary : "transparent" }]}>
                            {analytics && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.optionTitle, { color: colors.foreground }]}>Analytics & Improvements</Text>
                            <Text style={[styles.optionDesc, { color: colors.muted }]}>Help us improve app performance</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Links */}
                <View style={styles.linksContainer}>
                    <TouchableOpacity onPress={openPrivacyPolicy} style={styles.link}>
                        <Text style={[styles.linkText, { color: colors.primary }]}>
                            📄 Read Full Privacy Policy
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Consent checkbox */}
                <TouchableOpacity
                    style={[styles.checkbox, { borderColor: colors.border }]}
                    onPress={() => setAccepted(!accepted)}
                    activeOpacity={0.7}
                >
                    <View
                        style={[
                            styles.checkboxBox,
                            { borderColor: colors.border, backgroundColor: accepted ? colors.primary : "transparent" },
                        ]}
                    >
                        {accepted && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={[styles.checkboxText, { color: colors.foreground }]}>
                        I agree to the{" "}
                        <Text style={{ color: colors.primary }} onPress={openPrivacyPolicy}>
                            Privacy Policy
                        </Text>{" "}
                        and{" "}
                        <Text style={{ color: colors.primary }} onPress={openTerms}>
                            Terms of Service
                        </Text>
                    </Text>
                </TouchableOpacity>

                {/* Get Started button */}
                <TouchableOpacity
                    style={[
                        styles.button,
                        {
                            backgroundColor: accepted ? colors.primary : colors.muted,
                            opacity: accepted ? 1 : 0.5,
                        },
                    ]}
                    onPress={handleAccept}
                    disabled={!accepted}
                >
                    <Text style={styles.buttonText}>Get Started</Text>
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
}

// Hook to check consent and manage granular permissions
export function usePrivacyConsent() {
    const [hasConsent, setHasConsent] = useState(false);
    const [loading, setLoading] = useState(true);

    // Granular permissions state
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
    const [bgLocationConsent, setBgLocationConsentState] = useState(false);
    const [analyticsConsent, setAnalyticsConsentState] = useState(false);

    const checkConsent = async () => {
        try {
            const accepted = await hasAcceptedCurrentPolicy();
            setHasConsent(accepted);

            // Load granular data
            const data = await getConsentData();
            setPrivacyAccepted(data.privacyAccepted);
            setBgLocationConsentState(data.bgLocationConsent);
            setAnalyticsConsentState(data.analyticsConsent);
        } catch (error) {
            console.error("Error checking consent:", error);
            setHasConsent(false);
        } finally {
            setLoading(false);
        }
    };

    // Setters that persist to storage
    const setBgLocationConsent = async (value: boolean) => {
        setBgLocationConsentState(value);
        const current = await getConsentData();
        await saveConsentData({ ...current, bgLocationConsent: value });
    };

    const setAnalyticsConsent = async (value: boolean) => {
        setAnalyticsConsentState(value);
        const current = await getConsentData();
        await saveConsentData({ ...current, analyticsConsent: value });
    };

    const withdrawConsent = async () => {
        await storageWithdrawConsent();
        setHasConsent(false);
        setPrivacyAccepted(false);
        setBgLocationConsentState(false);
        setAnalyticsConsentState(false);
    };

    useEffect(() => {
        checkConsent();
    }, []);

    return {
        hasConsent,
        loading,
        checkConsent,
        privacyAccepted,
        bgLocationConsent,
        analyticsConsent,
        setBgLocationConsent,
        setAnalyticsConsent,
        withdrawConsent
    };
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 24,
        paddingTop: 60,
        paddingBottom: 40,
    },
    header: {
        alignItems: "center",
        marginBottom: 32,
    },
    logo: {
        fontSize: 64,
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        textAlign: "center",
        lineHeight: 22,
    },
    section: {
        padding: 20,
        borderRadius: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 16,
    },
    bulletPoint: {
        flexDirection: "row",
        marginBottom: 12,
        alignItems: "flex-start",
    },
    bullet: {
        fontSize: 20,
        marginRight: 12,
        marginTop: 2,
    },
    bulletText: {
        fontSize: 15,
        lineHeight: 22,
        flex: 1,
    },
    linksContainer: {
        marginVertical: 16,
        gap: 12,
    },
    link: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: "center",
    },
    linkText: {
        fontSize: 16,
        fontWeight: "600",
    },
    checkbox: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        marginTop: 8,
        marginBottom: 24,
    },
    checkboxBox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        marginRight: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    checkmark: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold",
    },
    checkboxText: {
        fontSize: 15,
        flex: 1,
        lineHeight: 20,
    },
    button: {
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: "center",
        marginBottom: 16,
    },
    buttonText: {
        color: "white",
        fontSize: 18,
        fontWeight: "600",
    },
    // Options
    optionRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: 16,
    },
    optionTitle: {
        fontSize: 15,
        fontWeight: "600",
        marginBottom: 2,
    },
    optionDesc: {
        fontSize: 13,
        lineHeight: 18,
    },
});
