import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ForwardedRef } from "react";
import { Text, View } from "react-native";

import colors from "~/types/colors";
import { useTheme } from "~/utils/ThemeContext";

export interface BarrierProperties {
  BARRIER_TYPE?: string;
  TRAVEL_PATH_WIDTH?: number;
  COLLECTED_AT?: string;
  jira_id?: string;
}

interface BarrierBottomSheetProps {
  ref: ForwardedRef<BottomSheetModal>;
}

const BARRIER_META: Record<string, { label: string; icon: string; desc: string }> = {
  sign: { label: "Sign Obstruction", icon: "🪧", desc: "A sign is blocking or narrowing the accessible travel path." },
  vehicle: { label: "Vehicle", icon: "🚗", desc: "A vehicle is obstructing the accessible pathway." },
  construction: { label: "Construction", icon: "🚧", desc: "Construction materials or equipment are in the travel path." },
  vegetation: { label: "Vegetation", icon: "🌿", desc: "Overgrown vegetation is encroaching on the accessible path." },
  furniture: { label: "Street Furniture", icon: "🪑", desc: "Street furniture or fixtures are obstructing the path." },
  utility: { label: "Utility Infrastructure", icon: "⚡", desc: "Utility infrastructure is blocking or narrowing the path." },
};

function formatDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch { return dateStr; }
}

const BarrierBottomSheet = ({ ref }: BarrierBottomSheetProps) => {
  const bottomTabBarHeight = useBottomTabBarHeight();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  const sheetBg = isDark ? "#1C1C1E" : "#FFFFFF";
  const textPrimary = isDark ? "#F3F4F6" : colors.theme.black;
  const divider = isDark ? "#3A3A3C" : colors.theme.majorgridline;
  const rowBg = isDark ? "#2C2C2E" : "#F9FAFB";
  const descBg = isDark ? "#3B0000" : "#FEF2F2";
  const descText = isDark ? "#FCA5A5" : "#7F1D1D";

  return (
    <BottomSheetModal<{ barrier: BarrierProperties }>
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
        if (!data?.barrier) return null;
        const { BARRIER_TYPE, TRAVEL_PATH_WIDTH, COLLECTED_AT, jira_id } = data.barrier;
        const key = (BARRIER_TYPE ?? "").toLowerCase();
        const meta = BARRIER_META[key];
        const label = meta?.label ?? (BARRIER_TYPE ?? "Unknown Barrier");
        const icon = meta?.icon ?? "⚠️";
        const desc = meta?.desc;
        const widthIn = TRAVEL_PATH_WIDTH != null ? `${TRAVEL_PATH_WIDTH.toFixed(0)} in` : null;
        const widthCm = TRAVEL_PATH_WIDTH != null ? `${(TRAVEL_PATH_WIDTH * 2.54).toFixed(0)} cm` : null;

        return (
          <BottomSheetView style={{ padding: 24, paddingBottom: 36 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: descBg, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 24 }}>{icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Roboto Flex", fontWeight: "700", fontSize: 20, color: textPrimary }}>
                  Accessibility Barrier
                </Text>
                <Text style={{ fontSize: 13, color: colors.theme.red, fontWeight: "600", marginTop: 2 }}>
                  {label}
                </Text>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: divider, marginBottom: 16 }} />

            {desc ? (
              <View style={{ backgroundColor: descBg, borderRadius: 14, borderLeftWidth: 4, borderLeftColor: colors.theme.red, padding: 14, marginBottom: 12 }}>
                <Text style={{ fontSize: 14, color: descText, fontFamily: "Inter", lineHeight: 20 }}>{desc}</Text>
              </View>
            ) : null}

            {widthIn ? (
              <View style={{ backgroundColor: rowBg, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 14, color: isDark ? "#9CA3AF" : "#64748B", fontFamily: "Inter" }}>Travel Path Width</Text>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: textPrimary, fontFamily: "Inter" }}>{widthIn}</Text>
                  <Text style={{ fontSize: 12, color: isDark ? "#6B7280" : "#94A3B8" }}>{widthCm}</Text>
                </View>
              </View>
            ) : null}

            {COLLECTED_AT ? (
              <View style={{ backgroundColor: rowBg, borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 14, color: isDark ? "#9CA3AF" : "#64748B", fontFamily: "Inter" }}>Last Assessed</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: textPrimary, fontFamily: "Inter" }}>{formatDate(COLLECTED_AT)}</Text>
              </View>
            ) : null}

            {jira_id ? (
              <Text style={{ fontSize: 12, color: isDark ? "#4B5563" : "#CBD5E1", marginTop: 4, textAlign: "right" }}>Ref: {jira_id}</Text>
            ) : null}
          </BottomSheetView>
        );
      }}
    </BottomSheetModal>
  );
};

export default BarrierBottomSheet;
