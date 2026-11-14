/** My Reports: This screen shows off the reports the user has made! -R.L. */
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ReportCard } from "~/src/features/reports/components/ReportCard";
import { ReportSection } from "~/src/features/reports/components/ReportSection";
import { ReportsEmptyState } from "~/src/features/reports/components/ReportsEmptyState";
import { getReportAddress } from "~/src/features/reports/getReportAddress";
import styles from "~/src/features/reports/styles";
import colors from "~/types/colors";
import type { MyReport } from "~/types/database";
import { useMyReports } from "~/utils/api-hooks";
import { useTheme } from "~/utils/ThemeContext";
import { useRefreshOnFocus } from "~/utils/useRefreshOnFocus";

// the nearest building's address, or the description if we can't find one -R.L.
const getSubtitle = (report: MyReport) =>
  getReportAddress(report.boundary_geojson) ?? (report.description || "No description");

export default function MyReportsScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  const { data: reports = [], isLoading, refetch } = useMyReports();
  // refetch when you come back to this tab, so new reports show up -R.L.
  useRefreshOnFocus(refetch);
  const activeReports = reports.filter((report) => report.status === "active");
  const historyReports = reports.filter((report) => report.status === "history");

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

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.ut.burntorange} />
      ) : reports.length === 0 ? (
        <ReportsEmptyState />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {activeReports.length > 0 && (
            <ReportSection title="Active reports">
              {activeReports.map((report) => (
                <ReportCard
                  key={report.id}
                  title={report.name}
                  subtitle={getSubtitle(report)}
                  variant="active"
                />
              ))}
            </ReportSection>
          )}
          {historyReports.length > 0 && (
            <ReportSection title="Report history">
              {historyReports.map((report) => (
                <ReportCard
                  key={report.id}
                  title={report.name}
                  subtitle={getSubtitle(report)}
                  variant="history"
                />
              ))}
            </ReportSection>
          )}
        </ScrollView>
      )}
    </View>
  );
}
