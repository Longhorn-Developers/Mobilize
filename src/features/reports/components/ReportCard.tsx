/** One report card, active ones get the cone icon and history ones get the warning triangle -R.L. */
import { TrafficConeIcon, WarningIcon } from "phosphor-react-native";
import { Text, View } from "react-native";

import styles from "~/src/features/reports/styles";
import colors from "~/types/colors";
import type { MyReport } from "~/types/database";
import { useTheme } from "~/utils/ThemeContext";

type ReportCardProps = {
  title: string;
  subtitle: string;
  variant: MyReport["status"];
};

export function ReportCard({ title, subtitle, variant }: ReportCardProps) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  const isActive = variant === "active";
  const tileColor = isActive
    ? isDark
      ? "#3A3A3C"
      : "#F3F4F6"
    : "rgba(209, 0, 0, 0.12)";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? "#2C2C2E" : "#FFFFFF",
          borderColor: isDark ? "#3A3A3C" : "#E5E7EB",
        },
      ]}
    >
      <View style={[styles.cardIconTile, { backgroundColor: tileColor }]}>
        {isActive ? (
          <TrafficConeIcon size={29} color={colors.ut.burntorange} />
        ) : (
          <WarningIcon size={29} color={colors.theme.red} />
        )}
      </View>
      <View style={styles.cardText}>
        <Text
          numberOfLines={1}
          style={[styles.cardTitle, { color: isDark ? "#F9FAFB" : colors.theme.black }]}
        >
          {title}
        </Text>
        <Text
          numberOfLines={2}
          style={[styles.cardSubtitle, { color: isDark ? "#9CA3AF" : "#64748B" }]}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
}
