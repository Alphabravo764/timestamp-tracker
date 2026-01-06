import { useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Share, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

export default function ShiftCompleteScreen() {
  const colors = useColors();
  const params = useLocalSearchParams();
  const shiftId = Number(params.shiftId);

  const { data: shift, isLoading } = trpc.shifts.getById.useQuery({ shiftId });
  const { data: photos } = trpc.photos.getShiftPhotos.useQuery({ shiftId });
  const generatePdfMutation = trpc.reports.generate.useMutation();
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const formatDuration = (minutes?: number) => {
    if (!minutes) return "N/A";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleShareReport = async () => {
    if (!shift) return;

    // Always use Railway production URL
    const reportUrl = `https://stampia.tech/viewer/${shift.pairCode}`;

    try {
      await Share.share({
        message: `View my shift report: ${reportUrl}`,
        url: reportUrl,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleViewReport = () => {
    if (!shift) return;
    // Always use Railway production URL
    const reportUrl = `https://stampia.tech/viewer/${shift.pairCode}`;
    // In a real app, open in-app browser
    window.open(reportUrl, "_blank");
  };

  const handleDownloadPdf = async () => {
    if (!shift) return;

    setGeneratingPdf(true);
    try {
      const result = await generatePdfMutation.mutateAsync({ shiftId: shift.id });
      // Open PDF in new tab
      window.open(result.pdfUrl, "_blank");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!shift) {
    return (
      <ScreenContainer className="p-6 justify-center">
        <View className="items-center gap-4">
          <Text className="text-2xl font-bold text-foreground text-center">Shift Not Found</Text>
          <TouchableOpacity
            className="bg-primary px-8 py-4 rounded-full mt-4"
            onPress={() => router.replace("/" as any)}
          >
            <Text className="text-white font-semibold text-lg">Go to Home</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <View className="flex-1 gap-6">
        {/* Success Header */}
        <View className="items-center gap-3">
          <View className="w-24 h-24 rounded-full bg-success/20 items-center justify-center">
            <Text className="text-6xl">✓</Text>
          </View>
          <Text className="text-3xl font-bold text-foreground text-center">Shift Complete</Text>
          <Text className="text-base text-muted text-center">
            Your shift has been successfully recorded
          </Text>
        </View>

        {/* Shift Summary */}
        <View className="bg-surface rounded-2xl p-6 border border-border gap-4">
          <Text className="text-xl font-semibold text-foreground">Summary</Text>

          <View className="gap-3">
            <View className="flex-row justify-between">
              <Text className="text-muted">Site</Text>
              <Text className="text-foreground font-semibold">{shift.siteName}</Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-muted">Duration</Text>
              <Text className="text-foreground font-semibold">
                {formatDuration(shift.durationMinutes ?? undefined)}
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-muted">Photos Taken</Text>
              <Text className="text-foreground font-semibold">{photos?.length || 0}</Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-muted">Started</Text>
              <Text className="text-foreground">
                {new Date(shift.startTimeUtc).toLocaleTimeString()}
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-muted">Ended</Text>
              <Text className="text-foreground">
                {shift.endTimeUtc ? new Date(shift.endTimeUtc).toLocaleTimeString() : "N/A"}
              </Text>
            </View>
          </View>
        </View>

        {/* Info Box */}
        <View className="bg-primary/10 rounded-xl p-4 border border-primary/20">
          <Text className="text-sm text-foreground">
            Your shift report is now available. You can view it online or download it as a PDF with
            all photos, timestamps, and location data.
          </Text>
        </View>

        {/* Action Buttons */}
        <View className="gap-3 mt-auto">
          <TouchableOpacity
            className="bg-primary px-6 py-4 rounded-full"
            onPress={handleViewReport}
          >
            <Text className="text-white font-semibold text-center text-lg">View Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-surface border border-border px-6 py-4 rounded-full"
            onPress={handleShareReport}
          >
            <Text className="text-foreground font-semibold text-center text-lg">
              Share Report Link
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-surface border border-border px-6 py-4 rounded-full"
            onPress={handleDownloadPdf}
            disabled={generatingPdf}
            style={{ opacity: generatingPdf ? 0.5 : 1 }}
          >
            {generatingPdf ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text className="text-foreground font-semibold text-center text-lg">
                Download PDF Report
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="px-6 py-4 rounded-full"
            onPress={() => router.replace("/" as any)}
          >
            <Text className="text-muted font-semibold text-center text-lg">Go to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}
