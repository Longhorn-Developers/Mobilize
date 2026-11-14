/** My Reports: This screen shows off the reports the user has made! -R.L. */
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ReportsEmptyState } from "~/src/features/reports/components/ReportsEmptyState";
import styles from "~/src/features/reports/styles";
import colors from "~/types/colors";
import { useTheme } from "~/utils/ThemeContext";

export default function MyReportsScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top,
          backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
        },
      ]}
    >
      <Text
        style={[styles.title, { color: isDark ? "#F9FAFB" : colors.theme.black }]}
      >
        My Reports
      </Text>
      <ReportsEmptyState />
    </View>
  );
}
