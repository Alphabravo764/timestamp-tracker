import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Platform, Alert, Linking } from "react-native";
import { WebView } from "react-native-webview";
import { useFocusEffect } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBaseUrl } from "@/constants/oauth";

const WATCHED_CODES_KEY = "watched_pair_codes";

export default function WatcherScreen() {
  const colors = useColors();
  const [pairCode, setPairCode] = useState("");
  const [watchedCodes, setWatchedCodes] = useState<string[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  // Load watched codes from storage
  useFocusEffect(
    useCallback(() => {
      loadWatchedCodes();
    }, [])
  );

  async function loadWatchedCodes() {
    try {
      const stored = await AsyncStorage.getItem(WATCHED_CODES_KEY);
      if (stored) {
        const codes = JSON.parse(stored);
        setWatchedCodes(codes);
        // Auto-select first code if available
        if (codes.length > 0 && !selectedCode) {
          setSelectedCode(codes[0]);
        }
      }
    } catch (error) {
      console.error("Failed to load watched codes:", error);
    }
  }

  async function saveWatchedCodes(codes: string[]) {
    try {
      await AsyncStorage.setItem(WATCHED_CODES_KEY, JSON.stringify(codes));
      setWatchedCodes(codes);
    } catch (error) {
      console.error("Failed to save watched codes:", error);
    }
  }

  function handleAddCode() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const normalized = pairCode.replace(/-/g, "").toUpperCase().trim();
    if (normalized.length !== 6) {
      Alert.alert("Invalid Code", "Pair code must be 6 characters");
      return;
    }

    if (watchedCodes.includes(normalized)) {
      Alert.alert("Already Added", "This pair code is already in your watch list");
      setSelectedCode(normalized);
      setPairCode("");
      return;
    }

    const newCodes = [normalized, ...watchedCodes];
    saveWatchedCodes(newCodes);
    setSelectedCode(normalized);
    setPairCode("");
  }

  function handleRemoveCode(code: string) {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    Alert.alert(
      "Remove Watch",
      `Remove ${code} from watch list?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            const newCodes = watchedCodes.filter((c) => c !== code);
            saveWatchedCodes(newCodes);
            if (selectedCode === code) {
              setSelectedCode(newCodes.length > 0 ? newCodes[0] : null);
            }
          },
        },
      ]
    );
  }

  const apiUrl = getApiBaseUrl();
  const viewerUrl = selectedCode ? `${apiUrl}/viewer/${selectedCode}` : null;

  return (
    <ScreenContainer className="flex-1">
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Watch Shifts</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Enter a pair code to watch a live shift
          </Text>
        </View>

        {/* Input Section */}
        <View style={[styles.inputSection, { backgroundColor: colors.surface }]}>
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="Enter pair code (e.g., ABC123)"
            placeholderTextColor={colors.muted}
            value={pairCode}
            onChangeText={setPairCode}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
          />
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={handleAddCode}
          >
            <Text style={[styles.addButtonText, { color: colors.background }]}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Watched Codes List */}
        {watchedCodes.length > 0 && (
          <View style={[styles.codesSection, { borderBottomColor: colors.border }]}>
            <Text style={[styles.codesLabel, { color: colors.muted }]}>Watching:</Text>
            <View style={styles.codesRow}>
              {watchedCodes.map((code) => (
                <TouchableOpacity
                  key={code}
                  style={[
                    styles.codeChip,
                    {
                      backgroundColor: selectedCode === code ? colors.primary : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => setSelectedCode(code)}
                  onLongPress={() => handleRemoveCode(code)}
                >
                  <Text
                    style={[
                      styles.codeChipText,
                      { color: selectedCode === code ? colors.background : colors.foreground },
                    ]}
                  >
                    {code}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.hint, { color: colors.muted }]}>
              Tap to view • Long press to remove
            </Text>
          </View>
        )}

        {/* WebView or Link */}
        {viewerUrl ? (
          Platform.OS === "web" ? (
            <View style={[styles.webLinkContainer, { backgroundColor: colors.surface }]}>
              <Text style={[styles.webLinkTitle, { color: colors.foreground }]}>
                🌐 Web Preview
              </Text>
              <Text style={[styles.webLinkSubtitle, { color: colors.muted }]}>
                WebView is only available on iOS and Android devices.
                Open the viewer in a new tab instead.
              </Text>
              <TouchableOpacity
                style={[styles.openButton, { backgroundColor: colors.primary }]}
                onPress={() => Linking.openURL(viewerUrl)}
              >
                <Text style={[styles.openButtonText, { color: colors.background }]}>
                  Open Viewer in New Tab
                </Text>
              </TouchableOpacity>
              <Text style={[styles.viewerUrl, { color: colors.muted }]}>
                {viewerUrl}
              </Text>
            </View>
          ) : (
            <View style={styles.webviewContainer}>
              <WebView
                source={{ uri: viewerUrl }}
                style={styles.webview}
                startInLoadingState
                javaScriptEnabled
                domStorageEnabled
              />
            </View>
          )
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              👁️ Add a pair code to start watching
            </Text>
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  inputSection: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: "600",
  },
  addButton: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  codesSection: {
    padding: 16,
    borderBottomWidth: 1,
  },
  codesLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  codesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  codeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  codeChipText: {
    fontSize: 14,
    fontWeight: "600",
  },
  hint: {
    fontSize: 11,
    marginTop: 8,
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
  },
  webLinkContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  webLinkTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  webLinkSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  openButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  openButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  viewerUrl: {
    fontSize: 12,
    marginTop: 8,
  },
});
