import AsyncStorage from "@react-native-async-storage/async-storage";

const CONSENT_KEY = "privacy_consent";

export interface ConsentData {
    privacyAccepted: boolean;
    privacyPolicyVersion: string;
    termsAccepted: boolean;
    bgLocationConsent: boolean;
    analyticsConsent: boolean;
    acceptedAt: string | null;
}

const DEFAULT_CONSENT: ConsentData = {
    privacyAccepted: false,
    privacyPolicyVersion: "",
    termsAccepted: false,
    bgLocationConsent: false,
    analyticsConsent: false,
    acceptedAt: null,
};

export const CURRENT_PRIVACY_VERSION = "2026-01-05";

export const getConsentData = async (): Promise<ConsentData> => {
    try {
        const json = await AsyncStorage.getItem(CONSENT_KEY);
        if (json) {
            return JSON.parse(json);
        }
        return DEFAULT_CONSENT;
    } catch (error) {
        console.error("Error getting consent data:", error);
        return DEFAULT_CONSENT;
    }
};

export const saveConsentData = async (data: ConsentData): Promise<void> => {
    try {
        await AsyncStorage.setItem(CONSENT_KEY, JSON.stringify(data));
    } catch (error) {
        console.error("Error saving consent data:", error);
        throw error;
    }
};

export const hasAcceptedCurrentPolicy = async (): Promise<boolean> => {
    const consent = await getConsentData();
    return (
        consent.privacyAccepted &&
        consent.termsAccepted &&
        consent.privacyPolicyVersion === CURRENT_PRIVACY_VERSION
    );
};

export const acceptRequiredConsents = async (
    bgLocation: boolean = false,
    analytics: boolean = false
): Promise<void> => {
    const consent: ConsentData = {
        privacyAccepted: true,
        privacyPolicyVersion: CURRENT_PRIVACY_VERSION,
        termsAccepted: true,
        bgLocationConsent: bgLocation,
        analyticsConsent: analytics,
        acceptedAt: new Date().toISOString(),
    };
    await saveConsentData(consent);
};

export const withdrawConsent = async (): Promise<void> => {
    await saveConsentData(DEFAULT_CONSENT);
};
