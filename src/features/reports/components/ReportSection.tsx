/** A titled group of report cards, used for "Active reports" and "Report history" -R.L. */
import { ReactNode } from "react";
import { Text, View } from "react-native";

import styles from "~/src/features/reports/styles";
import colors from "~/types/colors";
import { useTheme } from "~/utils/ThemeContext";

type ReportSectionProps = {
  title: string;
  children: ReactNode;
};

export function ReportSection({ title, children }: ReportSectionProps) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  return (
    <View style={styles.section}>
      <Text
        style={[styles.sectionTitle, { color: isDark ? "#F9FAFB" : colors.theme.black }]}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}
