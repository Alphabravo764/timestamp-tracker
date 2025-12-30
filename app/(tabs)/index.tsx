import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Share,
} from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";

export default function HomeScreen() {
  const colors = useColors();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch active shift
  const { data: activeShift, refetch: refetchActive } = trpc.shifts.getActive.useQuery(
    undefined,
    {
      enabled: isAuthenticated,
    }
  );

  // Fetch shift history
  const {
    data: shiftHistory,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = trpc.shifts.getHistory.useQuery(
    { limit: 20 },
    {
      enabled: isAuthenticated,
    }
  );

  // Dev login mutation
  const devLoginMutation = trpc.auth.devLogin.useMutation({
    onSuccess: () => {
      // Refresh auth state
      window.location.reload();
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchActive(), refetchHistory()]);
    setRefreshing(false);
  };

  const handleStartShift = () => {
    router.push("/shift/start" as any);
  };

  const handleViewActiveShift = () => {
    if (activeShift) {
      router.push("/shift/active" as any);
    }
  };

  const handleViewReport = (shiftId: number, liveToken: string) => {
    router.push(`/live/${liveToken}` as any);
  };

  const handleShareReport = async (shiftId: number, liveToken: string, siteName: string) => {
    const reportUrl = `${window.location.origin}/live/${liveToken}`;
    try {
      await Share.share({
        message: `View my shift report at ${siteName}: ${reportUrl}`,
        url: reportUrl,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return "N/A";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  if (authLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  const handleDevLogin = async () => {
    await devLoginMutation.mutateAsync({
      email: "staff@example.com",
      name: "Staff Member",
    });
  };

  if (!isAuthenticated) {
    return (
      <ScreenContainer className="p-6 justify-center">
        <View className="flex-1 items-center justify-center gap-6">
          <View className="items-center gap-2">
            <Text className="text-4xl font-bold text-foreground text-center">
              Welcome to Timestamp Tracker
            </Text>
            <Text className="text-base text-muted text-center mt-2">
              Track your shifts with timestamped photos and location data
            </Text>
          </View>

          <TouchableOpacity
            className="bg-primary px-8 py-4 rounded-full"
            onPress={handleDevLogin}
            disabled={devLoginMutation.isPending}
          >
            {devLoginMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-lg">Sign In to Start</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-6">
      <FlatList
        data={shiftHistory || []}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View className="gap-6 mb-6">
            {/* Header */}
            <View>
              <Text className="text-3xl font-bold text-foreground">Timestamp Tracker</Text>
              <Text className="text-base text-muted mt-1">
                Welcome back, {user?.name || "User"}
              </Text>
            </View>

            {/* Active Shift Card */}
            {activeShift ? (
              <TouchableOpacity
                className="bg-success/10 border-2 border-success rounded-2xl p-6"
                onPress={handleViewActiveShift}
              >
                <View className="flex-row items-center justify-between mb-3">
                  <View className="bg-success px-3 py-1 rounded-full">
                    <Text className="text-white font-semibold text-sm">ACTIVE SHIFT</Text>
                  </View>
                  <Text className="text-success font-semibold">Tap to view →</Text>
                </View>

                <Text className="text-xl font-bold text-foreground mb-1">
                  {activeShift.siteName}
                </Text>
                <Text className="text-muted">
                  Started at {formatTime(activeShift.startTimeUtc)}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                className="bg-primary px-6 py-4 rounded-full"
                onPress={handleStartShift}
              >
                <Text className="text-white font-semibold text-center text-lg">
                  Start New Shift
                </Text>
              </TouchableOpacity>
            )}

            {/* History Header */}
            <View className="flex-row items-center justify-between">
              <Text className="text-xl font-bold text-foreground">Shift History</Text>
              {shiftHistory && shiftHistory.length > 0 && (
                <Text className="text-muted text-sm">{shiftHistory.length} shifts</Text>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          historyLoading ? (
            <View className="items-center py-12">
              <ActivityIndicator size="large" color={colors.primary} />
              <Text className="text-muted mt-4">Loading shift history...</Text>
            </View>
          ) : (
            <View className="items-center py-12">
              <Text className="text-6xl mb-4">📋</Text>
              <Text className="text-xl font-semibold text-foreground mb-2">
                No Shift History
              </Text>
              <Text className="text-muted text-center">
                Your completed shifts will appear here
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View className="bg-surface rounded-2xl p-5 mb-4 border border-border">
            {/* Shift Header */}
            <View className="flex-row items-start justify-between mb-3">
              <View className="flex-1">
                <Text className="text-lg font-bold text-foreground mb-1">{item.siteName}</Text>
                <Text className="text-sm text-muted">{formatDate(item.startTimeUtc)}</Text>
              </View>
              <View
                className={`px-3 py-1 rounded-full ${
                  item.status === "completed"
                    ? "bg-success/20"
                    : item.status === "cancelled"
                      ? "bg-error/20"
                      : "bg-muted/20"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    item.status === "completed"
                      ? "text-success"
                      : item.status === "cancelled"
                        ? "text-error"
                        : "text-muted"
                  }`}
                >
                  {item.status.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Shift Details */}
            <View className="flex-row gap-4 mb-4">
              <View className="flex-1">
                <Text className="text-xs text-muted mb-1">Start Time</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {formatTime(item.startTimeUtc)}
                </Text>
              </View>
              {item.endTimeUtc && (
                <View className="flex-1">
                  <Text className="text-xs text-muted mb-1">End Time</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatTime(item.endTimeUtc)}
                  </Text>
                </View>
              )}
              {item.durationMinutes && (
                <View className="flex-1">
                  <Text className="text-xs text-muted mb-1">Duration</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatDuration(item.durationMinutes)}
                  </Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-primary px-4 py-3 rounded-xl"
                onPress={() => handleViewReport(item.id, item.liveToken)}
              >
                <Text className="text-white font-semibold text-center text-sm">
                  View Report
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-surface border border-border px-4 py-3 rounded-xl"
                onPress={() => handleShareReport(item.id, item.liveToken, item.siteName)}
              >
                <Text className="text-foreground font-semibold text-center text-sm">
                  Share Link
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        contentContainerStyle={{ flexGrow: 1 }}
      />
    </ScreenContainer>
  );
}
