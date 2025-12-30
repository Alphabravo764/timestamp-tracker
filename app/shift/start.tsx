import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import * as Location from "expo-location";

export default function StartShiftScreen() {
  const colors = useColors();
  const [siteName, setSiteName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const startShiftMutation = trpc.shifts.start.useMutation();

  const handleStartShift = async () => {
    if (!siteName.trim()) {
      Alert.alert("Site Name Required", "Please enter a site name to start your shift");
      return;
    }

    setLoading(true);

    try {
      // Request location permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== "granted") {
        Alert.alert(
          "Location Permission Required",
          "Location tracking is required to start a shift. Please enable location permissions in your device settings."
        );
        setLoading(false);
        return;
      }

      // Request background location permissions (for continuous tracking)
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
      if (backgroundStatus !== "granted") {
        Alert.alert(
          "Background Location Recommended",
          "For accurate tracking, please enable background location access. You can continue without it, but tracking may be limited.",
          [
            { text: "Cancel", style: "cancel", onPress: () => setLoading(false) },
            { text: "Continue Anyway", onPress: () => proceedWithStart() },
          ]
        );
        return;
      }

      await proceedWithStart();
    } catch (error) {
      console.error("Error starting shift:", error);
      Alert.alert("Error", "Failed to start shift. Please try again.");
      setLoading(false);
    }
  };

  const proceedWithStart = async () => {
    try {
      const shift = await startShiftMutation.mutateAsync({
        siteName: siteName.trim(),
        notes: notes.trim() || undefined,
      });

      Alert.alert("Shift Started", "Your shift has been started successfully", [
        {
          text: "OK",
          onPress: () => router.replace("/" as any),
        },
      ]);
    } catch (error: any) {
      console.error("Error starting shift:", error);
      Alert.alert("Error", error.message || "Failed to start shift. Please try again.");
      setLoading(false);
    }
  };

  return (
    <ScreenContainer className="p-6">
      <View className="flex-1 gap-6">
        {/* Header */}
        <View>
          <Text className="text-3xl font-bold text-foreground">Start New Shift</Text>
          <Text className="text-base text-muted mt-2">
            Enter the site details to begin tracking
          </Text>
        </View>

        {/* Form */}
        <View className="gap-4">
          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">
              Site Name <Text className="text-error">*</Text>
            </Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
              placeholder="e.g., Westfield Mall - North Entrance"
              placeholderTextColor={colors.muted}
              value={siteName}
              onChangeText={setSiteName}
              autoFocus
              returnKeyType="next"
            />
          </View>

          <View>
            <Text className="text-sm font-semibold text-foreground mb-2">
              Notes (Optional)
            </Text>
            <TextInput
              className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
              placeholder="Add any additional notes..."
              placeholderTextColor={colors.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              returnKeyType="done"
            />
          </View>
        </View>

        {/* Info Box */}
        <View className="bg-primary/10 rounded-xl p-4 border border-primary/20">
          <Text className="text-sm text-foreground">
            <Text className="font-semibold">Location tracking</Text> will start automatically when
            you begin your shift. Your location will be recorded periodically to create a complete
            record of your shift.
          </Text>
        </View>

        {/* Buttons */}
        <View className="gap-3 mt-auto">
          <TouchableOpacity
            className="bg-primary px-6 py-4 rounded-full"
            onPress={handleStartShift}
            disabled={loading || !siteName.trim()}
            style={{ opacity: loading || !siteName.trim() ? 0.5 : 1 }}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-center text-lg">Start Shift</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="px-6 py-4 rounded-full"
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text className="text-muted font-semibold text-center text-lg">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}
