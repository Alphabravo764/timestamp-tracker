import { Modal, View, Text, ScrollView, Pressable, Linking } from "react-native";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface TermsModalProps {
  visible: boolean;
  onAccept: () => void;
}

export function TermsModal({ visible, onAccept }: TermsModalProps) {
  const [activeTab, setActiveTab] = useState<"terms" | "privacy">("terms");

  const openPrivacyPolicy = () => {
    // In production, replace with your actual hosted policy URL
    Linking.openURL("https://your-domain.com/privacy-policy");
  };

  const openTerms = () => {
    // In production, replace with your actual hosted terms URL
    Linking.openURL("https://your-domain.com/terms-of-service");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        // Prevent closing without acceptance
      }}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="bg-primary px-6 pt-16 pb-6">
          <Text className="text-2xl font-bold text-white">Welcome to Timestamp Tracker</Text>
          <Text className="text-sm text-white/90 mt-2">
            Please review and accept our terms to continue
          </Text>
        </View>

        {/* Tab Switcher */}
        <View className="flex-row border-b border-border bg-surface">
          <Pressable
            onPress={() => setActiveTab("terms")}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className={cn(
              "flex-1 py-4 items-center border-b-2",
              activeTab === "terms" ? "border-primary" : "border-transparent"
            )}
          >
            <Text
              className={cn(
                "font-semibold",
                activeTab === "terms" ? "text-primary" : "text-muted"
              )}
            >
              Terms of Service
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("privacy")}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            className={cn(
              "flex-1 py-4 items-center border-b-2",
              activeTab === "privacy" ? "border-primary" : "border-transparent"
            )}
          >
            <Text
              className={cn(
                "font-semibold",
                activeTab === "privacy" ? "text-primary" : "text-muted"
              )}
            >
              Privacy Policy
            </Text>
          </Pressable>
        </View>

        {/* Content */}
        <ScrollView className="flex-1 px-6 py-4">
          {activeTab === "terms" ? (
            <View className="gap-4">
              <Text className="text-lg font-bold text-foreground">Key Terms</Text>
              
              <View className="gap-3">
                <View>
                  <Text className="font-semibold text-foreground">✓ Location Tracking</Text>
                  <Text className="text-sm text-muted mt-1">
                    Your GPS location is tracked every 30 seconds during active shifts for safety and accountability.
                  </Text>
                </View>

                <View>
                  <Text className="font-semibold text-foreground">✓ Photo & Data Storage</Text>
                  <Text className="text-sm text-muted mt-1">
                    Photos you capture are uploaded to secure cloud storage with timestamps and GPS coordinates.
                  </Text>
                </View>

                <View>
                  <Text className="font-semibold text-foreground">✓ Pair Code Sharing</Text>
                  <Text className="text-sm text-muted mt-1">
                    Your 6-character pair code allows authorized viewers to monitor your shift in real-time. Pair codes expire after 24 hours.
                  </Text>
                </View>

                <View>
                  <Text className="font-semibold text-foreground">✓ Data Retention</Text>
                  <Text className="text-sm text-muted mt-1">
                    Shift records are retained according to your organization's policy. You can request data deletion at any time.
                  </Text>
                </View>

                <View>
                  <Text className="font-semibold text-foreground">✓ Authorized Use Only</Text>
                  <Text className="text-sm text-muted mt-1">
                    Use this app only for legitimate work purposes as authorized by your employer.
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={openTerms}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="mt-4"
              >
                <Text className="text-primary font-medium">Read Full Terms of Service →</Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-4">
              <Text className="text-lg font-bold text-foreground">Your Privacy Matters</Text>
              
              <View className="gap-3">
                <View>
                  <Text className="font-semibold text-foreground">🔒 GDPR Compliant</Text>
                  <Text className="text-sm text-muted mt-1">
                    We comply with UK GDPR and Data Protection Act 2018. Your data rights are protected.
                  </Text>
                </View>

                <View>
                  <Text className="font-semibold text-foreground">📍 Location Data</Text>
                  <Text className="text-sm text-muted mt-1">
                    GPS coordinates are collected during shifts to track your patrol route. Data is encrypted in transit and at rest.
                  </Text>
                </View>

                <View>
                  <Text className="font-semibold text-foreground">📸 Photo Storage</Text>
                  <Text className="text-sm text-muted mt-1">
                    Photos are stored on secure cloud servers (Amazon S3) and accessible only to authorized users.
                  </Text>
                </View>

                <View>
                  <Text className="font-semibold text-foreground">🚫 No Third-Party Sharing</Text>
                  <Text className="text-sm text-muted mt-1">
                    We do not sell or share your data with third parties for marketing purposes.
                  </Text>
                </View>

                <View>
                  <Text className="font-semibold text-foreground">⏱️ Data Retention</Text>
                  <Text className="text-sm text-muted mt-1">
                    Pair codes expire after 24 hours. Shift data is retained per your organization's policy.
                  </Text>
                </View>

                <View>
                  <Text className="font-semibold text-foreground">✅ Your Rights</Text>
                  <Text className="text-sm text-muted mt-1">
                    You have the right to access, correct, delete, or port your data. Contact your administrator to exercise these rights.
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={openPrivacyPolicy}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
                className="mt-4"
              >
                <Text className="text-primary font-medium">Read Full Privacy Policy →</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* Accept Button */}
        <View className="px-6 py-4 border-t border-border bg-surface">
          <Pressable
            onPress={onAccept}
            style={({ pressed }) => [
              {
                transform: [{ scale: pressed ? 0.98 : 1 }],
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            className="bg-primary py-4 rounded-xl items-center"
          >
            <Text className="text-white font-bold text-base">Accept & Continue</Text>
          </Pressable>
          <Text className="text-xs text-muted text-center mt-3">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </View>
    </Modal>
  );
}
