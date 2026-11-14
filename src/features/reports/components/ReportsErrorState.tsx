/** Shown when loading the reports fails, with a button to try again -R.L. */
import { WarningIcon } from "phosphor-react-native";
import { Text, View } from "react-native";

import { Button } from "~/src/features/components/Button";
import styles from "~/src/features/reports/styles";
import colors from "~/types/colors";
import { useTheme } from "~/utils/ThemeContext";

type ReportsErrorStateProps = {
  onRetry: () => void;
};

export function ReportsErrorState({ onRetry }: ReportsErrorStateProps) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const textColor = isDark ? "#F9FAFB" : colors.theme.black;

  return (
    <View style={styles.emptyContainer}>
      <View
        style={[
          styles.emptyIconCircle,
          { backgroundColor: isDark ? "#2C2C2E" : "#F3F4F6" },
        ]}
      >
        <WarningIcon size={28} color={textColor} />
      </View>
      <Text style={[styles.stateTitle, { color: textColor }]}>
        {"Couldn't load your reports"}
      </Text>
      <Text style={[styles.stateBody, { color: isDark ? "#9CA3AF" : "#64748B" }]}>
        Check your connection and try again.
      </Text>
      <Button title="Try again" onPress={onRetry} />
    </View>
  );
}
