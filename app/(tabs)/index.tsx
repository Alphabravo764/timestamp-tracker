import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import { useColors } from "@/hooks/use-colors";
import { useState, useEffect } from "react";

export default function HomeScreen() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const colors = useColors();
  const [elapsedTime, setElapsedTime] = useState("");

  // Get active shift
  const { data: activeShift, isLoading, refetch } = trpc.shifts.getActive.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 5000, // Refetch every 5 seconds to update timer
  });

  // Calculate elapsed time
  useEffect(() => {
    if (!activeShift) {
      setElapsedTime("");
      return;
    }

    const updateElapsed = () => {
      const start = new Date(activeShift.startTimeUtc).getTime();
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
  }, [activeShift]);

  if (authLoading || isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!isAuthenticated) {
    return (
      <ScreenContainer className="p-6 justify-center">
        <View className="items-center gap-4">
          <Text className="text-2xl font-bold text-foreground text-center">
            Welcome to Timestamp Tracker
          </Text>
          <Text className="text-base text-muted text-center">
            Track your shifts with timestamped photos and location data
          </Text>
          <TouchableOpacity
            className="bg-primary px-8 py-4 rounded-full mt-4"
            onPress={() => router.push("/oauth/login" as any)}
          >
            <Text className="text-white font-semibold text-lg">Sign In to Start</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 gap-6">
          {/* Header */}
          <View className="items-center gap-2">
            <Text className="text-3xl font-bold text-foreground">
              {activeShift ? "Shift Active" : "Ready to Start"}
            </Text>
            <Text className="text-base text-muted text-center">
              {user?.name || "Staff Member"}
            </Text>
          </View>

          {/* Status Card */}
          <View className="bg-surface rounded-2xl p-6 border border-border">
            {activeShift ? (
              <>
                <View className="items-center gap-3">
                  <View className="bg-success px-4 py-2 rounded-full">
                    <Text className="text-white font-semibold">ON SHIFT</Text>
                  </View>
                  
                  <Text className="text-4xl font-bold text-foreground mt-2">
                    {elapsedTime}
                  </Text>
                  
                  <View className="items-center mt-2">
                    <Text className="text-sm text-muted">Site</Text>
                    <Text className="text-lg font-semibold text-foreground">
                      {activeShift.siteName}
                    </Text>
                  </View>

                  {activeShift.notes && (
                    <View className="items-center mt-2">
                      <Text className="text-sm text-muted">Notes</Text>
                      <Text className="text-base text-foreground text-center">
                        {activeShift.notes}
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  className="bg-primary px-6 py-4 rounded-full mt-6"
                  onPress={() => router.push("/shift/active" as any)}
                >
                  <Text className="text-white font-semibold text-center text-lg">
                    View Active Shift
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View className="items-center gap-3">
                  <Text className="text-xl font-semibold text-foreground">
                    No Active Shift
                  </Text>
                  <Text className="text-base text-muted text-center">
                    Start a new shift to begin tracking your location and taking timestamp photos
                  </Text>
                </View>

                <TouchableOpacity
                  className="bg-primary px-6 py-4 rounded-full mt-6"
                  onPress={() => router.push("/shift/start")}
                >
                  <Text className="text-white font-semibold text-center text-lg">
                    Start New Shift
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Info Section */}
          <View className="bg-surface rounded-2xl p-6 border border-border">
            <Text className="text-lg font-semibold text-foreground mb-3">
              How It Works
            </Text>
            <View className="gap-3">
              <View className="flex-row gap-3">
                <Text className="text-primary font-bold">1.</Text>
                <Text className="text-muted flex-1">
                  Start your shift and enter the site location
                </Text>
              </View>
              <View className="flex-row gap-3">
                <Text className="text-primary font-bold">2.</Text>
                <Text className="text-muted flex-1">
                  Your location is tracked automatically during the shift
                </Text>
              </View>
              <View className="flex-row gap-3">
                <Text className="text-primary font-bold">3.</Text>
                <Text className="text-muted flex-1">
                  Take timestamp photos with location data as proof of presence
                </Text>
              </View>
              <View className="flex-row gap-3">
                <Text className="text-primary font-bold">4.</Text>
                <Text className="text-muted flex-1">
                  End your shift and generate a PDF report with all evidence
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
