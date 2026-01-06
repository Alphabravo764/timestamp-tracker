import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Switch,
  Linking,
  Image,
  Alert,
  TextInput
} from "react-native";
import { useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useThemeContext } from "@/lib/theme-provider";
import { usePrivacyConsent } from "@/components/consent-screen";
import Constants from "expo-constants";
import { getSettings, saveSettings, getTrialUsage, TRIAL_LIMITS, PREMIUM_LIMITS, TrialUsage, getPremiumStatus, PremiumStatus, getDeviceId, activatePremium, getCurrentLimits } from "@/lib/settings-storage";
import { getApiBaseUrl } from "@/constants/oauth";

export default function SettingsScreen() {
  const colors = useColors();
  const { colorScheme, setColorScheme } = useThemeContext();
  const {
    privacyAccepted,
    bgLocationConsent,
    analyticsConsent,
    setBgLocationConsent,
    setAnalyticsConsent,
    withdrawConsent
  } = usePrivacyConsent();

  const [userName, setUserName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [trialUsage, setTrialUsage] = useState<TrialUsage | null>(null);
  const [premiumStatus, setPremiumStatus] = useState<PremiumStatus | null>(null);
  const [currentLimits, setCurrentLimits] = useState(TRIAL_LIMITS);
  const [accessCode, setAccessCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);

  const loadProfile = async () => {
    const settings = await getSettings();
    setUserName(settings.userName || "User");
    const usage = await getTrialUsage();
    setTrialUsage(usage);
    const premium = await getPremiumStatus();
    setPremiumStatus(premium);
    const limits = await getCurrentLimits();
    setCurrentLimits(limits);
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const handleRedeemCode = async () => {
    if (!accessCode.trim()) {
      Alert.alert("Enter Code", "Please enter your Premium Access Code.");
      return;
    }

    setIsRedeeming(true);
    try {
      const deviceId = await getDeviceId();
      const response = await fetch(`${getApiBaseUrl()}/api/trpc/premium.redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: { code: accessCode.trim().toUpperCase(), deviceId }
        })
      });

      const data = await response.json();
      const result = data?.result?.data?.json;

      if (result?.success) {
        await activatePremium(accessCode.trim().toUpperCase());
        await loadProfile();
        setAccessCode("");
        setShowCodeInput(false);
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Premium Access Activated",
          "You now have extended limits on this device.",
          [{ text: "Awesome!" }]
        );
      } else {
        Alert.alert("Invalid Code", result?.error || "Code not found or already used.");
      }
    } catch (error) {
      console.error("Redeem error:", error);
      Alert.alert("Error", "Could not validate code. Please check your connection and try again.");
    } finally {
      setIsRedeeming(false);
    }
  };

  const startEditing = () => {
    setTempName(userName);
    setIsEditingName(true);
  };

  const saveName = async () => {
    if (tempName.trim().length === 0) {
      Alert.alert("Name Required", "Please enter a valid name.");
      return;
    }

    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    await saveSettings({ userName: tempName.trim() });
    setUserName(tempName.trim());
    setIsEditingName(false);
  };

  const handleDarkModeChange = async (value: boolean) => {
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setColorScheme(value ? "dark" : "light");
  };

  const handleToggleBgLocation = async (value: boolean) => {
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBgLocationConsent(value);
  };

  const handleToggleAnalytics = async (value: boolean) => {
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnalyticsConsent(value);
  };

  const handleWithdrawConsent = () => {
    Alert.alert(
      "Withdraw Consent?",
      "This will reset your privacy settings and you will be prompted again on next launch.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: async () => {
            await withdrawConsent();
          }
        }
      ]
    );
  };

  return (
    <ScreenContainer className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView
        className="p-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Settings</Text>

        {/* --- PROFILE PROFILE --- */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: isEditingName ? 0 : 16 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#fff' }}>
                {userName ? userName.charAt(0).toUpperCase() : "O"}
              </Text>
            </View>

            {/* View Mode */}
            {!isEditingName && (
              <View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.foreground }}>{userName}</Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>Officer Profile</Text>
              </View>
            )}

            {/* Edit Mode */}
            {isEditingName && (
              <View style={{ flex: 1 }}>
                <TextInput
                  value={tempName}
                  onChangeText={setTempName}
                  style={{
                    borderBottomWidth: 2,
                    borderBottomColor: colors.primary,
                    fontSize: 18,
                    fontWeight: '700',
                    color: colors.foreground,
                    paddingVertical: 4
                  }}
                  autoFocus
                  placeholder="Enter Name"
                />
              </View>
            )}
          </View>

          {/* Action Buttons */}
          {!isEditingName ? (
            <TouchableOpacity
              style={{ width: '100%', paddingVertical: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 12, alignItems: 'center' }}
              onPress={startEditing}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
                onPress={() => setIsEditingName(false)}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: colors.primary }}
                onPress={saveName}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Save</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* --- USAGE & ACCESS --- */}
        <Text style={[styles.sectionHeader, { color: colors.muted }]}>
          {premiumStatus?.isPremium ? 'PREMIUM ACCESS' : 'TRIAL USAGE'}
        </Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: premiumStatus?.isPremium ? '#dcfce7' : '#fef3c7', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
              <Ionicons name={premiumStatus?.isPremium ? "shield-checkmark" : "timer"} size={20} color={premiumStatus?.isPremium ? '#16a34a' : '#d97706'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.foreground }}>
                {premiumStatus?.isPremium ? 'Premium Access Active' : 'Trial Version Active'}
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                {premiumStatus?.isPremium ? 'Extended limits unlocked' : 'Limited features available'}
              </Text>
            </View>
          </View>

          {/* Usage Counters */}
          <View style={{ gap: 12 }}>
            {/* Shifts */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="briefcase-outline" size={16} color={colors.muted} />
                <Text style={{ fontSize: 13, color: colors.foreground }}>Shifts</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: trialUsage && trialUsage.shiftsUsed >= currentLimits.maxShifts ? '#ef4444' : '#22c55e' }}>
                  {trialUsage?.shiftsUsed || 0}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>/ {currentLimits.maxShifts}</Text>
              </View>
            </View>

            {/* Reports */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="document-text-outline" size={16} color={colors.muted} />
                <Text style={{ fontSize: 13, color: colors.foreground }}>PDF Reports</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: trialUsage && trialUsage.reportsGenerated >= currentLimits.maxReports ? '#ef4444' : '#22c55e' }}>
                  {trialUsage?.reportsGenerated || 0}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>/ {currentLimits.maxReports}</Text>
              </View>
            </View>

            {/* Live Shares */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="share-social-outline" size={16} color={colors.muted} />
                <Text style={{ fontSize: 13, color: colors.foreground }}>Live View Shares</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: trialUsage && trialUsage.liveSharesUsed >= currentLimits.maxLiveShares ? '#ef4444' : '#22c55e' }}>
                  {trialUsage?.liveSharesUsed || 0}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>/ {currentLimits.maxLiveShares}</Text>
              </View>
            </View>
          </View>

          {/* Unlock Premium Section */}
          {!premiumStatus?.isPremium && (
            <View style={{ marginTop: 16 }}>
              {!showCodeInput ? (
                <TouchableOpacity
                  style={{ backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                  onPress={() => setShowCodeInput(true)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="key" size={18} color="#fff" />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Unlock Premium Access</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={{ backgroundColor: '#eff6ff', borderRadius: 12, padding: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#1e40af', marginBottom: 8 }}>Enter your Premium Access Code</Text>
                  <TextInput
                    value={accessCode}
                    onChangeText={setAccessCode}
                    placeholder="STAMPIA-XXXXXXXX"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="characters"
                    style={{
                      backgroundColor: '#fff',
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 16,
                      fontWeight: '600',
                      color: '#1e293b',
                      borderWidth: 1,
                      borderColor: '#e2e8f0',
                      marginBottom: 12,
                      textAlign: 'center',
                      letterSpacing: 1,
                    }}
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={{ flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}
                      onPress={() => { setShowCodeInput(false); setAccessCode(""); }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748b' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ flex: 1, backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}
                      onPress={handleRedeemCode}
                      disabled={isRedeeming}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>
                        {isRedeeming ? 'Validating...' : 'Redeem Code'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Premium Active Confirmation */}
          {premiumStatus?.isPremium && (
            <View style={{ backgroundColor: '#dcfce7', borderRadius: 12, padding: 12, marginTop: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#166534', marginLeft: 6 }}>PREMIUM ACCESS ACTIVATED</Text>
              </View>
              <Text style={{ fontSize: 11, color: '#166534', lineHeight: 16 }}>
                Code: {premiumStatus.code} • Activated: {premiumStatus.activatedAt ? new Date(premiumStatus.activatedAt).toLocaleDateString() : 'N/A'}
              </Text>
            </View>
          )}
        </View>

        {/* --- CONTACT & SUPPORT --- */}
        <Text style={[styles.sectionHeader, { color: colors.muted, marginTop: 16 }]}>CONTACT & SUPPORT</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: 0 }]}>

          {/* Email Support */}
          <TouchableOpacity
            style={[styles.row, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            onPress={() => Linking.openURL("mailto:contact@stampia.tech?subject=STAMPIA%20Support")}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="mail-outline" size={18} color="#2563eb" />
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>Email Support</Text>
                <Text style={[styles.rowSubtitle, { color: colors.muted }]}>contact@stampia.tech</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>

          {/* Report Issue / Feedback */}
          <TouchableOpacity
            style={[styles.row, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            onPress={() => Linking.openURL("mailto:feedback@stampia.tech?subject=STAMPIA%20Feedback")}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.iconBox, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="chatbubble-outline" size={18} color="#d97706" />
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>Send Feedback</Text>
                <Text style={[styles.rowSubtitle, { color: colors.muted }]}>Report issues or request features</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>

          {/* Customisation Request */}
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL("mailto:custom@stampia.tech?subject=STAMPIA%20Customisation%20Request")}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.iconBox, { backgroundColor: '#f0fdf4' }]}>
                <Ionicons name="construct-outline" size={18} color="#16a34a" />
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>Request Customisation</Text>
                <Text style={[styles.rowSubtitle, { color: colors.muted }]}>Custom branding & features available</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* --- PRIVACY & PERMISSIONS --- */}
        <Text style={[styles.sectionHeader, { color: colors.muted }]}>PRIVACY & PERMISSIONS</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: 0 }]}>

          {/* Privacy Policy */}
          <TouchableOpacity
            style={[styles.row, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
            onPress={() => Linking.openURL("https://stampia.tech/privacy-policy")}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="lock-closed-outline" size={18} color="#2563eb" />
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>Privacy Policy</Text>
                <Text style={[styles.rowSubtitle, { color: colors.muted }]}>Read terms & data use</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>

          {/* Background Location */}
          <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.iconBox, { backgroundColor: '#f1f5f9' }]}>
                <Ionicons name="location-outline" size={18} color="#475569" />
              </View>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>Background Location</Text>
            </View>
            <Switch
              value={bgLocationConsent}
              onValueChange={handleToggleBgLocation}
              trackColor={{ false: colors.border, true: '#2563eb' }}
              thumbColor={"#fff"}
            />
          </View>

          {/* Analytics */}
          <View style={styles.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.iconBox, { backgroundColor: '#f1f5f9' }]}>
                <Ionicons name="stats-chart-outline" size={18} color="#475569" />
              </View>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>Analytics Consent</Text>
            </View>
            <Switch
              value={analyticsConsent}
              onValueChange={handleToggleAnalytics}
              trackColor={{ false: colors.border, true: '#2563eb' }}
              thumbColor={"#fff"}
            />
          </View>
        </View>

        {/* --- PREFERENCES --- */}
        <Text style={[styles.sectionHeader, { color: colors.muted, marginTop: 24 }]}>PREFERENCES</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: 0 }]}>

          {/* Dark Mode */}
          <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.iconBox, { backgroundColor: '#f1f5f9' }]}>
                <Ionicons name="moon-outline" size={18} color="#475569" />
              </View>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>Dark Mode</Text>
            </View>
            <Switch
              value={colorScheme === 'dark'}
              onValueChange={handleDarkModeChange}
              trackColor={{ false: colors.border, true: '#2563eb' }}
              thumbColor={"#fff"}
            />
          </View>

          {/* App Version */}
          <View style={styles.row}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.iconBox, { backgroundColor: '#faf5ff' }]}>
                <Ionicons name="information-circle-outline" size={18} color="#9333ea" />
              </View>
              <Text style={[styles.rowTitle, { color: colors.foreground }]}>App Version</Text>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>
              {Constants.expoConfig?.version ?? '1.0.0'}
            </Text>
          </View>
        </View>

        {/* --- ABOUT US --- */}
        <Text style={[styles.sectionHeader, { color: colors.muted, marginTop: 24 }]}>ABOUT US</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
              <Image
                source={require('@/assets/images/icon.png')}
                style={{ width: 36, height: 36, borderRadius: 6 }}
                resizeMode="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.foreground }}>STAMPIA</Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>Proof of Presence</Text>
            </View>
          </View>

          <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 20, marginBottom: 12 }}>
            We are a unique timestamp provider, filling the gap where small business owners or individuals who can't afford their own tracking portal can rely on our services.
          </Text>

          <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 20, marginBottom: 12 }}>
            Our app provides verified proof of presence with GPS tracking, photo evidence, and professional PDF reports - all without expensive subscriptions or complex setup.
          </Text>

          <View style={{ backgroundColor: '#fef3c7', borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="warning" size={16} color="#d97706" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#92400e', marginLeft: 6 }}>TRIAL VERSION</Text>
            </View>
            <Text style={{ fontSize: 11, color: '#92400e', lineHeight: 16 }}>
              This is a trial version. Full features will be available in our upcoming paid release.
            </Text>
          </View>

          <View style={{ backgroundColor: '#f0fdf4', borderRadius: 12, padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Ionicons name="construct" size={16} color="#16a34a" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#166534', marginLeft: 6 }}>CUSTOMISATION AVAILABLE</Text>
            </View>
            <Text style={{ fontSize: 11, color: '#166534', lineHeight: 16 }}>
              Need custom branding or features? Contact us for tailored solutions for your business.
            </Text>
          </View>

          <TouchableOpacity
            style={{ marginTop: 12, paddingVertical: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 12, alignItems: 'center' }}
            onPress={() => Linking.openURL("https://stampia.tech")}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.primary }}>Visit stampia.tech</Text>
          </TouchableOpacity>
        </View>

        {/* Withdraw Consent Link */}
        <TouchableOpacity
          style={{ marginTop: 24, alignSelf: 'center' }}
          onPress={handleWithdrawConsent}
        >
          <Text style={{ fontSize: 13, color: colors.error, fontWeight: '600' }}>Withdraw Privacy Consent</Text>
        </TouchableOpacity>

      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 12,
    paddingLeft: 8,
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
    overflow: 'hidden', // for children rows
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
});
