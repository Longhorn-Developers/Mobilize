import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ForwardedRef } from "react";
import { Text, View } from "react-native";

import colors from "~/types/colors";

export interface ConstructionInfo {
  id: string;
  description?: string;
}

interface ConstructionBottomSheetProps {
  ref: ForwardedRef<BottomSheetModal>;
}

const ConstructionBottomSheet = ({ ref }: ConstructionBottomSheetProps) => {
  const bottomTabBarHeight = useBottomTabBarHeight();

  return (
    <BottomSheetModal<{ construction: ConstructionInfo }>
      ref={ref}
      bottomInset={bottomTabBarHeight}
      backgroundStyle={{ borderRadius: 32 }}
      enableDynamicSizing
      handleIndicatorStyle={{ backgroundColor: colors.theme.majorgridline, width: 80 }}
    >
      {({ data }) => {
        if (!data?.construction) return null;
        const { id, description } = data.construction;

        return (
          <BottomSheetView style={{ padding: 24, paddingBottom: 36 }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: "#FFF7ED",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 24 }}>🚧</Text>
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
                  Construction Zone
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: "#D97706",
                    fontWeight: "600",
                    marginTop: 2,
                  }}
                >
                  Active — Expect disruptions
                </Text>
              </View>
            </View>

            <View
              style={{ height: 1, backgroundColor: colors.theme.majorgridline, marginBottom: 16 }}
            />

            {/* Warning card */}
            <View
              style={{
                backgroundColor: "#FFFBEB",
                borderRadius: 14,
                borderLeftWidth: 4,
                borderLeftColor: "#F59E0B",
                padding: 14,
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  color: "#92400E",
                  fontFamily: "Inter",
                  lineHeight: 20,
                }}
              >
                {description ||
                  "Active construction in this area may obstruct accessible pathways. Please use alternate routes."}
              </Text>
            </View>

            {/* Tip */}
            <View
              style={{
                backgroundColor: "#F9FAFB",
                borderRadius: 14,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Text style={{ fontSize: 20 }}>♿</Text>
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  color: "#64748B",
                  fontFamily: "Inter",
                  lineHeight: 18,
                }}
              >
                Check nearby sidewalk layers for compliant alternate paths.
              </Text>
            </View>

            <Text style={{ fontSize: 12, color: "#CBD5E1", marginTop: 12, textAlign: "right" }}>
              Zone {id}
            </Text>
          </BottomSheetView>
        );
      }}
    </BottomSheetModal>
  );
};

export default ConstructionBottomSheet;
