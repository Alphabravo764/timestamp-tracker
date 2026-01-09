/**
 * GDPR Consent and Legal Text Constants
 * Used for in-app consent popups and compliance
 */

// ===== GDPR CONSENT POPUP =====
// Show this BEFORE requesting location permission

export const GDPR_CONSENT = {
    title: "Location & Data Consent",

    // Short version for popup
    shortMessage: `STAMPIA needs your location to create verified shift records.

We collect:
• GPS coordinates during shifts
• Photos you capture with timestamps
• Notes you add

Your data is used only to provide the service and generate reports. We do not sell your data.

By continuing, you agree to our Privacy Policy.`,

    // Buttons
    acceptButton: "I Agree",
    declineButton: "Not Now",
    privacyLinkText: "Read Privacy Policy",
    privacyLinkUrl: "https://stampia.tech/policies/privacy-policy",

    // Full version for settings/legal screen
    fullMessage: `STAMPIA – Proof of Presence

To provide verified shift tracking, we need to collect:

📍 Location Data
• GPS coordinates during active shifts
• Timestamps of location points
• Reverse-geocoded addresses

📸 Photos & Notes
• Images you capture with time/location
• Notes you add during shifts

🔒 How We Use Your Data
• Create shift timelines and reports
• Enable live sharing (when you choose)
• Improve app reliability

We do NOT:
• Sell or share your data with advertisers
• Track you outside of active shifts
• Use your data for purposes you haven't agreed to

You can delete your data at any time from Settings.

For full details, see our Privacy Policy at:
https://stampia.tech/policies/privacy-policy

Contact: contact@stampia.tech`,
};

// ===== PDF TRIAL WATERMARK =====
// Added to PDF reports during trial period

export const PDF_WATERMARK = {
    // Text displayed on PDF
    text: "STAMPIA TRIAL",

    // Subtext under watermark
    subtext: "stampia.tech",

    // Footer disclaimer for trial PDFs
    trialDisclaimer: "This report was generated during the STAMPIA trial period. Some features may be limited. Visit stampia.tech to learn about premium options.",

    // Styles (used by PDF generator)
    opacity: 0.15,
    rotation: -45, // degrees
    fontSize: 72,
    color: "#94a3b8",
};

// ===== EVIDENCE DISCLAIMER =====
// Added to all PDFs regardless of tier

export const EVIDENCE_DISCLAIMER = {
    title: "Evidence Notice",
    text: "This document provides tamper-evident verification of presence data. Location accuracy depends on device GPS capabilities and environmental conditions. STAMPIA does not guarantee suitability for legal or forensic purposes. This report should be considered supplementary evidence.",
};

// ===== LOCATION PERMISSION TEXT =====
// iOS/Android permission request text

export const LOCATION_PERMISSION = {
    // Initial request
    title: "Enable Location",
    message: "STAMPIA needs location access to verify your presence during shifts. Your location is only tracked while you have an active shift.",

    // Background location (if needed)
    backgroundTitle: "Background Location",
    backgroundMessage: "To continue tracking your shift when the app is in the background, please allow 'Always' location access. Your location is only used during active shifts.",

    // If denied
    deniedTitle: "Location Required",
    deniedMessage: "STAMPIA cannot function without location access. Please enable location permissions in your device settings to use the app.",
};
