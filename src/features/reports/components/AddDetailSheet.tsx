/** The "Add details" bottom sheet that comes up on My Reports, for filling in a report that has no description yet -R.L. */
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
  useBottomSheetModal,
} from "@gorhom/bottom-sheet";
import { PlusIcon, XIcon } from "phosphor-react-native";
import { ForwardedRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "~/src/features/components/Button";
import { ReportCard } from "~/src/features/reports/components/ReportCard";
import { getReportSubtitle } from "~/src/features/reports/getReportAddress";
import styles from "~/src/features/reports/styles";
import colors from "~/types/colors";
import type { MyReport } from "~/types/database";
import { useTheme } from "~/utils/ThemeContext";

const MIN_DETAIL_LENGTH = 10;
const MAX_DETAIL_LENGTH = 500;

export type AddDetailSheetData = { report: MyReport };

type AddDetailSheetProps = {
  ref: ForwardedRef<BottomSheetModal<AddDetailSheetData>>;
};

function AddDetailForm({ report }: { report: MyReport }) {
  const { colorScheme } = useTheme();
  const { dismiss } = useBottomSheetModal();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === "dark";
  const textColor = isDark ? "#F9FAFB" : colors.theme.black;

  // start with what's already written, so an existing report can be edited -R.L.
  const [detail, setDetail] = useState(report.description ?? "");
  const canSubmit = detail.trim().length >= MIN_DETAIL_LENGTH;
  const sheetTitle = report.description ? "Edit details" : "Add details";

  const handleSubmit = () => {
    // TODO: save this once PATCH /avoidance_areas/:id exists -R.L.
    console.log(`Add detail submitted for report ${report.id}: ${detail.trim()}`);
    dismiss();
  };

  const handleDelete = () => {
    // TODO: delete this once DELETE /avoidance_areas/:id exists -R.L.
    console.log(`Delete requested for report ${report.id}`);
    dismiss();
  };

  return (
    // keep the buttons above the home indicator, since the sheet now goes to the very bottom -R.L.
    <BottomSheetView style={[styles.sheetContent, { paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.sheetHeader}>
        <Text style={[styles.sheetTitle, { color: textColor }]}>{sheetTitle}</Text>
        <TouchableOpacity onPress={() => dismiss()} accessibilityLabel="Close">
          <XIcon size={24} color={textColor} />
        </TouchableOpacity>
      </View>

      <ReportCard title={report.name} subtitle={getReportSubtitle(report)} variant="active" />

      <Text style={[styles.fieldLabel, { color: textColor }]}>Brief detail about the issue</Text>
      <BottomSheetTextInput
        value={detail}
        onChangeText={setDetail}
        multiline
        maxLength={MAX_DETAIL_LENGTH}
        placeholder="How was the accessibility? Any specific details that would help other students?"
        placeholderTextColor="#9CA3AF"
        style={[
          styles.textInput,
          {
            color: textColor,
            backgroundColor: isDark ? "#2C2C2E" : "#FFFFFF",
            borderColor: isDark ? "#3A3A3C" : "#E5E7EB",
          },
        ]}
      />

      <Text style={[styles.fieldLabel, { color: textColor }]}>Add a photo (optional)</Text>
      {/* TODO: photo picking isn't built yet, the camera is only in ReportModal for now -R.L. */}
      <View style={[styles.photoTile, { backgroundColor: isDark ? "#3A3A3C" : "#F3F4F6" }]}>
        <PlusIcon size={24} color={isDark ? "#9CA3AF" : "#64748B"} />
      </View>

      <View style={styles.sheetActions}>
        <Button
          title="Delete"
          variant="secondary"
          onPress={handleDelete}
          style={styles.sheetActionButton}
        />
        <Button
          title="Submit"
          variant={canSubmit ? "primary" : "disabled"}
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={styles.sheetActionButton}
        />
      </View>
    </BottomSheetView>
  );
}

export function AddDetailSheet({ ref }: AddDetailSheetProps) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  return (
    <BottomSheetModal<AddDetailSheetData>
      ref={ref}
      enableDynamicSizing
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
      )}
      backgroundStyle={{
        borderRadius: 32,
        backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
      }}
      handleIndicatorStyle={{
        backgroundColor: isDark ? "#52525B" : colors.theme.majorgridline,
        width: 80,
      }}
    >
      {({ data }) => (data?.report ? <AddDetailForm report={data.report} /> : null)}
    </BottomSheetModal>
  );
}
