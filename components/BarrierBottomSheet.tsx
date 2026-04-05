import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ForwardedRef } from "react";
import { Text, View } from "react-native";

import colors from "~/types/colors";

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
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

const BarrierBottomSheet = ({ ref }: BarrierBottomSheetProps) => {
  const bottomTabBarHeight = useBottomTabBarHeight();

  return (
    <BottomSheetModal<{ barrier: BarrierProperties }>
      ref={ref}
      bottomInset={bottomTabBarHeight}
      backgroundStyle={{ borderRadius: 32 }}
      enableDynamicSizing
      handleIndicatorStyle={{ backgroundColor: colors.theme.majorgridline, width: 80 }}
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
        const widthCm = TRAVEL_PATH_WIDTH != null
          ? `${(TRAVEL_PATH_WIDTH * 2.54).toFixed(0)} cm`
          : null;

        return (
          <BottomSheetView style={{ padding: 24, paddingBottom: 36 }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: "#FEF2F2",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 24 }}>{icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Roboto Flex",
                    fontWeight: "700",
                    fontSize: 20,
                    color: colors.theme.black,
                  }}
                >
                  Accessibility Barrier
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.theme.red,
                    fontWeight: "600",
                    marginTop: 2,
                  }}
                >
                  {label}
                </Text>
              </View>
            </View>

            <View
              style={{ height: 1, backgroundColor: colors.theme.majorgridline, marginBottom: 16 }}
            />

            {/* Description */}
            {desc ? (
              <View
                style={{
                  backgroundColor: "#FEF2F2",
                  borderRadius: 14,
                  borderLeftWidth: 4,
                  borderLeftColor: colors.theme.red,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: "#7F1D1D",
                    fontFamily: "Inter",
                    lineHeight: 20,
                  }}
                >
                  {desc}
                </Text>
              </View>
            ) : null}

            {/* Path width */}
            {widthIn ? (
              <View
                style={{
                  backgroundColor: "#F9FAFB",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 10,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, color: "#64748B", fontFamily: "Inter" }}>
                  Travel Path Width
                </Text>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: colors.theme.black,
                      fontFamily: "Inter",
                    }}
                  >
                    {widthIn}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#94A3B8" }}>{widthCm}</Text>
                </View>
              </View>
            ) : null}

            {/* Assessed date */}
            {COLLECTED_AT ? (
              <View
                style={{
                  backgroundColor: "#F9FAFB",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 10,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, color: "#64748B", fontFamily: "Inter" }}>
                  Last Assessed
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: colors.theme.black,
                    fontFamily: "Inter",
                  }}
                >
                  {formatDate(COLLECTED_AT)}
                </Text>
              </View>
            ) : null}

            {jira_id ? (
              <Text style={{ fontSize: 12, color: "#94A3B8", marginTop: 4, textAlign: "right" }}>
                Ref: {jira_id}
              </Text>
            ) : null}
          </BottomSheetView>
        );
      }}
    </BottomSheetModal>
  );
};

export default BarrierBottomSheet;
