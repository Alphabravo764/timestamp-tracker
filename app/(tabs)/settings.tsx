import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Switch,
  Linking,
  Alert,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import { getSettings, saveSettings, type AppSettings } from "@/lib/settings-storage";
import { getTemplates, deleteTemplate, type ShiftTemplate } from "@/lib/shift-templates";
import { useThemeContext } from "@/lib/theme-provider";

export default function SettingsScreen() {
  const colors = useColors();
  const { colorScheme, setColorScheme } = useThemeContext();
  const [settings, setSettings] = useState<AppSettings>({
    darkMode: "system",
    autoSaveTemplates: true,
    locationInterval: 30,
  });
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
      loadTemplates();
    }, [])
  );

  const loadSettings = async () => {
    const loaded = await getSettings();
    setSettings(loaded);
  };

  const loadTemplates = async () => {
    const loaded = await getTemplates();
    setTemplates(loaded);
  };

  const handleDarkModeChange = async (mode: "system" | "light" | "dark") => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    await saveSettings({ darkMode: mode });
    setSettings(prev => ({ ...prev, darkMode: mode }));
    
    // Update theme provider - for system mode, use the current system preference
    if (mode === "system") {
      // Let the system decide - we'll use light as default
      const systemPrefers = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      setColorScheme(systemPrefers);
    } else {
      setColorScheme(mode);
    }
  };

  const handleAutoSaveChange = async (value: boolean) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    await saveSettings({ autoSaveTemplates: value });
    setSettings(prev => ({ ...prev, autoSaveTemplates: value }));
  };

  const handleDeleteTemplate = async (id: string) => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    await deleteTemplate(id);
    loadTemplates();
  };

  return (
    <ScreenContainer className="flex-1">
      <ScrollView className="p-6" showsVerticalScrollIndicator={false}>
        <Text className="text-3xl font-bold text-foreground mb-2">Settings</Text>
        <Text className="text-muted mb-6">Customize your app preferences</Text>

        {/* Appearance Section */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>🎨 Appearance</Text>
          
          <Text style={[styles.label, { color: colors.muted }]}>Theme</Text>
          <View style={styles.themeOptions}>
            {(["system", "light", "dark"] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.themeOption,
                  { 
                    backgroundColor: settings.darkMode === mode ? colors.primary : colors.background,
                    borderColor: settings.darkMode === mode ? colors.primary : colors.border,
                  }
                ]}
                onPress={() => handleDarkModeChange(mode)}
              >
                <Text style={[
                  styles.themeOptionText,
                  { color: settings.darkMode === mode ? "#FFF" : colors.foreground }
                ]}>
                  {mode === "system" ? "☀️🌙 Auto" : mode === "light" ? "☀️ Light" : "🌙 Dark"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Templates Section */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>⚡ Quick Start Templates</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>Auto-save Templates</Text>
              <Text style={[styles.settingDesc, { color: colors.muted }]}>
                Save site & staff names for quick access
              </Text>
            </View>
            <Switch
              value={settings.autoSaveTemplates}
              onValueChange={handleAutoSaveChange}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFF"
            />
          </View>

          {templates.length > 0 && (
            <View style={styles.templatesList}>
              <Text style={[styles.label, { color: colors.muted, marginTop: 16 }]}>
                Saved Templates ({templates.length})
              </Text>
              {templates.map((template) => (
                <View 
                  key={template.id} 
                  style={[styles.templateItem, { borderColor: colors.border }]}
                >
                  <View style={styles.templateInfo}>
                    <Text style={[styles.templateSite, { color: colors.foreground }]}>
                      {template.siteName}
                    </Text>
                    <Text style={[styles.templateStaff, { color: colors.muted }]}>
                      {template.staffName} • Used {template.usageCount}x
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.deleteBtn, { backgroundColor: colors.error + "20" }]}
                    onPress={() => handleDeleteTemplate(template.id)}
                  >
                    <Text style={[styles.deleteBtnText, { color: colors.error }]}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Privacy & Legal Section */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>🔒 Privacy & Legal</Text>
          
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => {
              // In production, replace with your actual hosted policy URL
              Alert.alert(
                "Privacy Policy",
                "Your privacy matters. We comply with UK GDPR and protect your data.\n\n• Location tracked during shifts only\n• Photos stored securely in cloud\n• Pair codes expire after 24 hours\n• No third-party data sharing\n• You can request data deletion anytime",
                [{ text: "OK" }]
              );
            }}
          >
            <Text style={[styles.linkLabel, { color: colors.foreground }]}>Privacy Policy</Text>
            <Text style={[styles.linkArrow, { color: colors.muted }]}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => {
              // In production, replace with your actual hosted terms URL
              Alert.alert(
                "Terms of Service",
                "Key terms:\n\n• Location tracking every 30 seconds during shifts\n• Photos uploaded to secure cloud storage\n• Pair codes provide temporary access (24h expiry)\n• Use only for authorized work purposes\n• You're responsible for pair code security",
                [{ text: "OK" }]
              );
            }}
          >
            <Text style={[styles.linkLabel, { color: colors.foreground }]}>Terms of Service</Text>
            <Text style={[styles.linkArrow, { color: colors.muted }]}>→</Text>
          </TouchableOpacity>

          <View style={[styles.infoBox, { backgroundColor: colors.background }]}>
            <Text style={[styles.infoText, { color: colors.muted }]}>🇬🇧 UK GDPR Compliant</Text>
            <Text style={[styles.infoText, { color: colors.muted, marginTop: 4 }]}>Your data rights are protected</Text>
          </View>
        </View>

        {/* About Section */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>ℹ️ About</Text>
          
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.muted }]}>App Version</Text>
            <Text style={[styles.aboutValue, { color: colors.foreground }]}>1.0.0</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.muted }]}>Location Interval</Text>
            <Text style={[styles.aboutValue, { color: colors.foreground }]}>Every 30 seconds</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.muted }]}>Data Retention</Text>
            <Text style={[styles.aboutValue, { color: colors.foreground }]}>Per organization policy</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.muted }]}>Pair Code Expiry</Text>
            <Text style={[styles.aboutValue, { color: colors.foreground }]}>24 hours</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 8,
  },
  themeOptions: {
    flexDirection: "row",
    gap: 8,
  },
  themeOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  themeOptionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  settingDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  templatesList: {
    marginTop: 8,
  },
  templateItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  templateInfo: {
    flex: 1,
  },
  templateSite: {
    fontSize: 15,
    fontWeight: "600",
  },
  templateStaff: {
    fontSize: 13,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
    borderRadius: 8,
  },
  deleteBtnText: {
    fontSize: 16,
  },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  aboutLabel: {
    fontSize: 14,
  },
  aboutValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  linkLabel: {
    fontSize: 15,
    fontWeight: "500",
  },
  linkArrow: {
    fontSize: 18,
  },
  infoBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 13,
  },
});
