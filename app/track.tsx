import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, Keyboard } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

export default function WatchScreen() {
  const colors = useColors();
  const router = useRouter();
  const [pairCode, setPairCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const code = pairCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 6) {
      setError("Please enter a valid 6-character pair code");
      return;
    }
    if (Platform.OS !== "web") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
    setError(null);
    router.push(`/viewer/${code}`);
  };

  const formatCodeInput = (text: string) => {
    const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, "");
    setPairCode(cleaned.length <= 3 ? cleaned : `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}`);
  };

  return (
    <ScreenContainer className="flex-1">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Live Tracker</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Enter the pair code shared by the security guard to view their live location</Text>
        </View>

        <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.inputLabel, { color: colors.foreground }]}>Pair Code</Text>
          <TextInput
            style={[styles.codeInput, { backgroundColor: colors.background, borderColor: error ? colors.error : colors.border, color: colors.foreground }]}
            placeholder="ABC-123"
            placeholderTextColor={colors.muted}
            value={pairCode}
            onChangeText={formatCodeInput}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
          {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
          <Text style={[styles.hint, { color: colors.muted }]}>The guard can find this code on their active shift screen</Text>
        </View>

        <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }]} onPress={handleSubmit}>
          <Text style={styles.submitBtnText}>View Live Location</Text>
        </TouchableOpacity>

        <View style={[styles.infoSection, { borderColor: colors.border }]}>
          <Text style={[styles.infoTitle, { color: colors.foreground }]}>How it works</Text>
          {[
            "The security guard starts a shift on their mobile app",
            "They share their pair code with you (e.g., ABC-123)",
            "Enter the code above to see their live location and photos"
          ].map((text, i) => (
            <View key={i} style={styles.infoItem}>
              <Text style={[styles.infoNumber, { color: colors.primary }]}>{i + 1}</Text>
              <Text style={[styles.infoText, { color: colors.muted }]}>{text}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  header: { marginBottom: 32, alignItems: "center" },
  title: { fontSize: 32, fontWeight: "bold", marginBottom: 12, textAlign: "center" },
  subtitle: { fontSize: 16, textAlign: "center", lineHeight: 24, maxWidth: 320 },
  inputCard: { padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: "600", marginBottom: 12, textAlign: "center" },
  codeInput: { height: 64, borderRadius: 12, borderWidth: 2, paddingHorizontal: 20, fontSize: 32, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", letterSpacing: 8, textAlign: "center", fontWeight: "bold" },
  errorText: { fontSize: 14, marginTop: 8, textAlign: "center" },
  hint: { fontSize: 12, marginTop: 12, textAlign: "center" },
  submitBtn: { padding: 18, borderRadius: 12, alignItems: "center", marginBottom: 32 },
  submitBtnText: { color: "#FFF", fontSize: 18, fontWeight: "600" },
  infoSection: { borderTopWidth: 1, paddingTop: 24 },
  infoTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16, textAlign: "center" },
  infoItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12, paddingHorizontal: 8 },
  infoNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(10, 126, 164, 0.1)", textAlign: "center", lineHeight: 28, fontSize: 14, fontWeight: "bold", marginRight: 12 },
  infoText: { flex: 1, fontSize: 14, lineHeight: 22 },
});
