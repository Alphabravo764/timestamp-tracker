import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

export default function WatchScreen() {
  const colors = useColors();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmedCode = code.trim().toUpperCase();
    
    if (!trimmedCode) {
      setError("Please enter a pair code");
      return;
    }
    
    if (trimmedCode.length < 4) {
      setError("Code must be at least 4 characters");
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      // Navigate to the viewer with the code
      router.push(`/viewer/${trimmedCode}`);
    } catch (e) {
      console.error("Watch error:", e);
      setError("Failed to load shift. Please check the code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.icon]}>👁️</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Live Shift Viewer
            </Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              Enter the pair code to view a shift in real-time
            </Text>
          </View>

          {/* Code Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.foreground }]}>
              Pair Code
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  borderColor: error ? colors.error : colors.border,
                  color: colors.foreground,
                },
              ]}
              value={code}
              onChangeText={(text) => {
                setCode(text.toUpperCase());
                setError("");
              }}
              placeholder="e.g. ABC123"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={10}
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />
            {error ? (
              <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
            ) : null}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: colors.primary },
              loading && styles.buttonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {loading ? "Loading..." : "View Shift"}
            </Text>
          </TouchableOpacity>

          {/* Info */}
          <View style={[styles.infoBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.infoTitle, { color: colors.foreground }]}>
              How it works
            </Text>
            <Text style={[styles.infoText, { color: colors.muted }]}>
              1. Get the pair code from the security officer{"\n"}
              2. Enter the code above{"\n"}
              3. View live location, photos, and notes
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 4,
  },
  error: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  button: {
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 32,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  infoBox: {
    padding: 20,
    borderRadius: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 24,
  },
});
