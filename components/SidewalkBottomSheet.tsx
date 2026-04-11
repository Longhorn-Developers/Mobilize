import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ForwardedRef } from "react";
import { Text, View } from "react-native";

import colors from "~/types/colors";
import { useTheme } from "~/utils/ThemeContext";

export interface SidewalkSegment {
  id: string;
  compliant: number | null;
  score: number;
}

interface SidewalkData {
  segment: SidewalkSegment;
}

interface SidewalkBottomSheetProps {
  ref: ForwardedRef<BottomSheetModal>;
}

const SidewalkBottomSheet = ({ ref }: SidewalkBottomSheetProps) => {
  const bottomTabBarHeight = useBottomTabBarHeight();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  const sheetBg = isDark ? "#1C1C1E" : "#FFFFFF";
  const textPrimary = isDark ? "#F3F4F6" : colors.theme.black;
  const textMuted = isDark ? "#9CA3AF" : "#64748B";
  const trackBg = isDark ? "#3A3A3C" : "#E5E7EB";

  return (
    <BottomSheetModal<SidewalkData>
      ref={ref}
      bottomInset={bottomTabBarHeight}
      backgroundStyle={{ borderRadius: 32, backgroundColor: sheetBg }}
      enableDynamicSizing
      handleIndicatorStyle={{
        backgroundColor: isDark ? "#52525B" : colors.theme.majorgridline,
        width: 80,
      }}
    >
      {({ data }) => {
        if (!data?.segment) return null;
        const { compliant, score } = data.segment;

        const statusLabel =
          compliant === 1 ? "ADA Compliant" :
          compliant === 0 ? "Not Compliant" :
          "Compliance Unknown";

        const statusColor =
          compliant === 1 ? colors.ut.green :
          compliant === 0 ? colors.theme.red :
          colors.ut.gray;

        const statusBg =
          compliant === 1 ? (isDark ? "#14532D" : "#F0FDF4") :
          compliant === 0 ? (isDark ? "#7F1D1D" : "#FEF2F2") :
          (isDark ? "#2C2C2E" : "#F9FAFB");

        return (
          <BottomSheetView style={{ padding: 24, paddingBottom: 32 }}>
            <Text style={{ fontFamily: "Roboto Flex", fontWeight: "700", fontSize: 22, color: textPrimary, marginBottom: 16 }}>
              Sidewalk Segment
            </Text>

            <View style={{
              alignSelf: "flex-start",
              backgroundColor: statusBg,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 6,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: statusColor + "40",
            }}>
              <Text style={{ fontFamily: "Inter", fontWeight: "600", fontSize: 15, color: statusColor }}>
                {statusLabel}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <Text style={{ fontFamily: "Inter", fontSize: 15, color: textMuted, fontWeight: "500", width: 120 }}>
                Accessibility Score
              </Text>
              <View style={{ flex: 1, height: 8, backgroundColor: trackBg, borderRadius: 4, overflow: "hidden" }}>
                <View style={{ width: `${Math.min(score, 100)}%`, height: "100%", backgroundColor: statusColor, borderRadius: 4 }} />
              </View>
              <Text style={{ fontFamily: "Inter", fontWeight: "700", fontSize: 15, color: textPrimary, width: 44, textAlign: "right" }}>
                {score.toFixed(1)}
              </Text>
            </View>

            <Text style={{ fontFamily: "Inter", fontSize: 12, color: isDark ? "#6B7280" : "#94A3B8", marginTop: 8 }}>
              Score reflects sidewalk surface condition and ADA compliance measurements.
            </Text>
          </BottomSheetView>
        );
      }}
    </BottomSheetModal>
  );
};

export default SidewalkBottomSheet;
