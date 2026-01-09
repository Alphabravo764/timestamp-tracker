import { View, type ViewProps, StyleSheet } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";

export interface ScreenContainerProps extends ViewProps {
  /**
   * SafeArea edges to apply. Defaults to ["top", "left", "right"].
   * Bottom is typically handled by Tab Bar.
   */
  edges?: Edge[];
}

/**
 * A container component that properly handles SafeArea and background colors.
 * Uses useColors() hook to get proper theme colors.
 */
export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  style,
  ...props
}: ScreenContainerProps) {
  const colors = useColors();

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background }, style]}
      {...props}
    >
      <SafeAreaView edges={edges} style={styles.safeArea}>
        <View style={styles.content}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
