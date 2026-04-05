import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ForwardedRef } from "react";
import { Linking, Text, TouchableOpacity, View } from "react-native";

import colors from "~/types/colors";

export interface BuildingProperties {
  Description?: string;
  Address_Full?: string;
  Map_Classification?: string;
  Building_Details_URL?: string;
}

interface BuildingBottomSheetProps {
  ref: ForwardedRef<BottomSheetModal>;
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  GeneralPurpose: "General Purpose",
  Athletic: "Athletic",
  Residential: "Residential",
  Research: "Research",
  Administrative: "Administrative",
  Support: "Support",
  Parking: "Parking",
};

const BuildingBottomSheet = ({ ref }: BuildingBottomSheetProps) => {
  const bottomTabBarHeight = useBottomTabBarHeight();

  return (
    <BottomSheetModal<{ building: BuildingProperties }>
      ref={ref}
      bottomInset={bottomTabBarHeight}
      backgroundStyle={{ borderRadius: 32 }}
      enableDynamicSizing
      handleIndicatorStyle={{ backgroundColor: colors.theme.majorgridline, width: 80 }}
    >
      {({ data }) => {
        if (!data?.building) return null;
        const { Description, Address_Full, Map_Classification, Building_Details_URL } =
          data.building;
        const classLabel =
          CLASSIFICATION_LABELS[Map_Classification ?? ""] ?? Map_Classification ?? null;

        return (
          <BottomSheetView style={{ padding: 24, paddingBottom: 36 }}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  backgroundColor: "#FDF0E8",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 24 }}>🏛️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Roboto Flex",
                    fontWeight: "700",
                    fontSize: 20,
                    color: colors.theme.black,
                    lineHeight: 24,
                  }}
                >
                  {Description || "Campus Building"}
                </Text>
                {classLabel ? (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      backgroundColor: "#FDF0E8",
                      borderRadius: 20,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      marginTop: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.ut.burntorange,
                        fontWeight: "600",
                      }}
                    >
                      {classLabel}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View
              style={{ height: 1, backgroundColor: colors.theme.majorgridline, marginBottom: 16 }}
            />

            {/* Address row */}
            {Address_Full ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: "#F9FAFB",
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 12,
                }}
              >
                <Text style={{ fontSize: 18 }}>📍</Text>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 14,
                    color: "#374151",
                    fontFamily: "Inter",
                    fontWeight: "500",
                  }}
                >
                  {Address_Full}
                </Text>
              </View>
            ) : null}

            {/* Details link */}
            {Building_Details_URL ? (
              <TouchableOpacity
                style={{
                  marginTop: 4,
                  backgroundColor: colors.ut.burntorange,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
                onPress={() => Linking.openURL(Building_Details_URL)}
              >
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: "700",
                    fontSize: 15,
                    fontFamily: "Inter",
                  }}
                >
                  View Building Details
                </Text>
              </TouchableOpacity>
            ) : null}
          </BottomSheetView>
        );
      }}
    </BottomSheetModal>
  );
};

export default BuildingBottomSheet;
