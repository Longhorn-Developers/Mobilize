/** Shown on My Reports when the user hasn't made any reports yet -R.L. */
import { FlagIcon } from "phosphor-react-native";
import { Text, View } from "react-native";

import styles from "~/src/features/reports/styles";
import colors from "~/types/colors";
import { useTheme } from "~/utils/ThemeContext";

export function ReportsEmptyState() {
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
        <FlagIcon size={28} color={textColor} />
      </View>
      <Text style={[styles.emptyText, { color: textColor }]}>
        {"You don't have any reports yet."}
      </Text>
    </View>
  );
}
