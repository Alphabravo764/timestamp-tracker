import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  RefreshControl,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";

export default function LiveViewerScreen() {
  const colors = useColors();
  const params = useLocalSearchParams();
  const token = params.token as string;

  const [elapsedTime, setElapsedTime] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Fetch shift data by token (public access)
  const {
    data: shiftData,
    isLoading,
    refetch,
  } = trpc.shifts.getByToken.useQuery(
    { token },
    {
      refetchInterval: 5000,
    }
  );

  const shift = shiftData?.shift;
  const latestLocation = shiftData?.latestLocation;
  const photos = shiftData?.photos || [];

  // Calculate elapsed time for active shifts
  useEffect(() => {
    if (!shift || shift.status !== "active") {
      setElapsedTime("");
      return;
    }

    const updateElapsed = () => {
      const start = new Date(shift.startTimeUtc).getTime();
      const now = Date.now();
      const diff = now - start;

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setElapsedTime(
        `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [shift]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return "N/A";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-muted mt-4">Loading shift data...</Text>
      </ScreenContainer>
    );
  }

  if (!shift) {
    return (
      <ScreenContainer className="p-6 justify-center">
        <View className="items-center gap-4">
          <Text className="text-2xl font-bold text-foreground text-center">
            Shift Not Found
          </Text>
          <Text className="text-base text-muted text-center">
            This shift link is invalid or has expired
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const isActive = shift.status === "active";

  return (
    <ScreenContainer className="p-6">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View className="flex-1 gap-6">
          {/* Header */}
          <View className="items-center gap-2">
            <View
              className={`px-4 py-2 rounded-full ${isActive ? "bg-success" : "bg-muted"}`}
            >
              <Text className="text-white font-semibold">
                {isActive ? "LIVE - ON SHIFT" : "SHIFT COMPLETED"}
              </Text>
            </View>

            {isActive && elapsedTime && (
              <Text className="text-4xl font-bold text-foreground mt-2">{elapsedTime}</Text>
            )}

            <Text className="text-xl font-semibold text-foreground mt-2">
              {shift.siteName}
            </Text>
          </View>

          {/* Shift Details */}
          <View className="bg-surface rounded-2xl p-6 border border-border gap-3">
            <Text className="text-lg font-semibold text-foreground">Shift Details</Text>

            <View className="flex-row justify-between">
              <Text className="text-muted">Status</Text>
              <Text className="text-foreground font-semibold">
                {shift.status.toUpperCase()}
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-muted">Started</Text>
              <Text className="text-foreground">
                {new Date(shift.startTimeUtc).toLocaleString()}
              </Text>
            </View>

            {shift.endTimeUtc && (
              <View className="flex-row justify-between">
                <Text className="text-muted">Ended</Text>
                <Text className="text-foreground">
                  {new Date(shift.endTimeUtc).toLocaleString()}
                </Text>
              </View>
            )}

            {shift.durationMinutes && (
              <View className="flex-row justify-between">
                <Text className="text-muted">Duration</Text>
                <Text className="text-foreground font-semibold">
                  {formatDuration(shift.durationMinutes)}
                </Text>
              </View>
            )}

            {shift.notes && (
              <View>
                <Text className="text-muted">Notes</Text>
                <Text className="text-foreground mt-1">{shift.notes}</Text>
              </View>
            )}
          </View>

          {/* Current Location (for active shifts) */}
          {isActive && latestLocation && (
            <View className="bg-surface rounded-2xl p-6 border border-border">
              <Text className="text-lg font-semibold text-foreground mb-3">
                📍 Current Location
              </Text>
              <View className="gap-1">
                <Text className="text-muted text-sm">
                  Latitude: {latestLocation.latitude}
                </Text>
                <Text className="text-muted text-sm">
                  Longitude: {latestLocation.longitude}
                </Text>
                {latestLocation.accuracy && (
                  <Text className="text-muted text-sm">
                    Accuracy: ±{latestLocation.accuracy}m
                  </Text>
                )}
                <Text className="text-muted text-xs mt-2">
                  Last updated: {new Date(latestLocation.capturedAt).toLocaleTimeString()}
                </Text>
              </View>

              {/* Google Maps Link */}
              <TouchableOpacity
                className="bg-primary px-4 py-3 rounded-xl mt-4"
                onPress={() => {
                  const mapsUrl = `https://www.google.com/maps?q=${latestLocation.latitude},${latestLocation.longitude}`;
                  window.open(mapsUrl, "_blank");
                }}
              >
                <Text className="text-white font-semibold text-center">
                  View on Google Maps
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Photo Timeline */}
          <View className="bg-surface rounded-2xl p-6 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-3">
              📸 Photo Timeline ({photos.length})
            </Text>

            {photos.length === 0 ? (
              <Text className="text-muted text-center py-4">No photos yet</Text>
            ) : (
              <View className="gap-4">
                {photos.map((photo) => (
                  <View
                    key={photo.id}
                    className="bg-background rounded-xl p-4 border border-border"
                  >
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1">
                        <Text className="text-foreground font-semibold">
                          {photo.photoType.toUpperCase()} Photo
                        </Text>
                        <Text className="text-muted text-xs">
                          {new Date(photo.capturedAt).toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    {photo.latitude && photo.longitude && (
                      <Text className="text-muted text-xs mb-2">
                        📍 {photo.latitude}, {photo.longitude}
                      </Text>
                    )}

                    <TouchableOpacity
                      className="bg-primary/10 px-3 py-2 rounded-lg"
                      onPress={() => window.open(photo.fileUrl, "_blank")}
                    >
                      <Text className="text-primary text-center text-sm font-semibold">
                        View Photo
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Download Report (for completed shifts) */}
          {!isActive && (
            <View className="bg-primary/10 rounded-xl p-4 border border-primary/20">
              <Text className="text-sm text-foreground mb-3">
                This shift is complete. You can download a detailed PDF report with all photos,
                timestamps, and location data.
              </Text>
              <TouchableOpacity
                className="bg-primary px-4 py-3 rounded-xl"
                onPress={() => {
                  // In a real implementation, this would call the PDF generation API
                  alert("PDF download will be implemented");
                }}
              >
                <Text className="text-white font-semibold text-center">
                  Download PDF Report
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Auto-refresh indicator */}
          {isActive && (
            <View className="items-center py-2">
              <Text className="text-xs text-muted">
                Auto-refreshing every 5 seconds...
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
