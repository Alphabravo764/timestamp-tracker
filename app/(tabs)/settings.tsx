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
import { getSettings, saveSettings } from "@/lib/settings-storage";

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

  const loadProfile = async () => {
    const settings = await getSettings();
    setUserName(settings.userName || "Officer");
  };

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

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
