/** My Reports: This screen shows off the reports the user has made! -R.L. */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AddDetailSheet,
  type AddDetailSheetData,
} from "~/src/features/reports/components/AddDetailSheet";
import { ReportCard } from "~/src/features/reports/components/ReportCard";
import { ReportSection } from "~/src/features/reports/components/ReportSection";
import { ReportsEmptyState } from "~/src/features/reports/components/ReportsEmptyState";
import { ReportsErrorState } from "~/src/features/reports/components/ReportsErrorState";
import { ReportsGatedState } from "~/src/features/reports/components/ReportsGatedState";
import { getReportSubtitle } from "~/src/features/reports/getReportAddress";
import styles from "~/src/features/reports/styles";
import colors from "~/types/colors";
import { useMyReports } from "~/utils/api-hooks";
import { useTheme } from "~/utils/ThemeContext";
import { useAuth } from "~/utils/useAuth";
import { useRefreshOnFocus } from "~/utils/useRefreshOnFocus";

export default function MyReportsScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const { user } = useAuth();
  const addDetailSheetRef = useRef<BottomSheetModal<AddDetailSheetData>>(null);

  // same rule as the map screen: only UT students can see reports -R.L.
  const canViewReports =
    user?.role === "student" || user?.email?.toLowerCase().endsWith("@utexas.edu") === true;

  const { data: reports = [], isLoading, isError, refetch } = useMyReports(canViewReports);
  // refetch when you come back to this tab, so new reports show up -R.L.
  useRefreshOnFocus(refetch);
  const activeReports = reports.filter((report) => report.status === "active");
  const historyReports = reports.filter((report) => report.status === "history");

  const renderContent = () => {
    if (!canViewReports) return <ReportsGatedState isSignedIn={user !== null} />;
    if (isLoading) return <ActivityIndicator size="large" color={colors.ut.burntorange} />;
    // if a refresh fails but we still have old reports, keep showing them -R.L.
    if (isError && reports.length === 0) return <ReportsErrorState onRetry={refetch} />;
    if (reports.length === 0) return <ReportsEmptyState />;

    return (
      <ScrollView contentContainerStyle={styles.list}>
        {activeReports.length > 0 && (
          <ReportSection title="Active reports">
            {activeReports.map((report) => (
              <ReportCard
                key={report.id}
                title={report.name}
                subtitle={getReportSubtitle(report)}
                variant="active"
                onPress={() => addDetailSheetRef.current?.present({ report })}
                // a report with no description still needs its details filled in -R.L.
                onAddDetail={
                  report.description ? undefined : () => addDetailSheetRef.current?.present({ report })
                }
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
                subtitle={getReportSubtitle(report)}
                variant="history"
                onPress={() => addDetailSheetRef.current?.present({ report })}
              />
            ))}
          </ReportSection>
        )}
      </ScrollView>
    );
  };

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
      {renderContent()}
      <AddDetailSheet ref={addDetailSheetRef} />
    </View>
  );
}
