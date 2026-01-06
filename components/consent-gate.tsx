import { useState } from "react";
import { ConsentScreen, usePrivacyConsent } from "@/components/consent-screen";
import { View, ActivityIndicator } from "react-native";

/**
 * Wrapper component that checks for privacy consent before showing the app
 * Shows consent screen on first launch, then shows children (main app) after consent
 */
export function ConsentGate({ children }: { children: React.ReactNode }) {
    const { hasConsent, loading, checkConsent } = usePrivacyConsent();
    const [consentGiven, setConsentGiven] = useState(false);

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    // Show consent screen if no consent yet and user hasn't given consent in this session
    if (!hasConsent && !consentGiven) {
        return (
            <ConsentScreen
                onConsent={async () => {
                    setConsentGiven(true);
                    await checkConsent(); // Refresh consent status
                }}
            />
        );
    }

    // Show main app
    return <>{children}</>;
}
