import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ForwardedRef } from "react";
import { Linking, Text, Pressable, View } from "react-native";
import { LocationPin } from "~/assets/map_icons/svg_icons";
import colors from "~/types/colors";
import { useTheme } from "~/utils/ThemeContext";
import { typography } from "~/utils/typography";

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
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  return (
    <BottomSheetModal<{ building: BuildingProperties }>
      ref={ref}
      bottomInset={bottomTabBarHeight}
      backgroundStyle={{ borderRadius: 32, backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }}
      enableDynamicSizing={false}
      snapPoints={["50%"]}
      handleIndicatorStyle={{
        backgroundColor: isDark ? "#52525B" : colors.theme.majorgridline,
        width: 80,
      }}
      enableContentPanningGesture={false}
    >
      {({ data }) => {
        if (!data?.building) return null;
        const { Description, Address_Full, Map_Classification, Building_Details_URL } =
          data.building;
        const classLabel =
          CLASSIFICATION_LABELS[Map_Classification ?? ""] ?? Map_Classification ?? null;

        return (
          <BottomSheetScrollView style={{ flex: 1 }}>
            <View style={{ padding: 24 }}>

              {/* Title */}
              <Text style={{ fontFamily: "Roboto Flex", 
                fontWeight: "700", fontSize: 30.25, 
                color: isDark ? "#F3F4F6" : "#1A2024", marginBottom: 2 }}>
                {Description || "Campus Building"}
              </Text>

              {/* Address */}
              {Address_Full ? (
                <View style={{ flexDirection: "row", marginBottom: 8, margin: 4, alignItems: "center", gap: 8 }}>
                  <LocationPin />
                  <Text style={{ fontFamily: typography.body.medium_strong.fontFamily, fontWeight: "500", fontSize: 15.35, color: isDark ? "#D1D5DB" : "#1A2024" }}>
                    {Address_Full}
                  </Text>
                </View>
              ) : null}

              {/* Classification row */}
              <View style={{ flexDirection: "row", marginBottom: 8, alignItems: "center", gap: 16 }}>
                <View style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
                  <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: isDark ? "#6B7280" : "#B3B3B3", fontWeight: "500" }}>Type</Text>
                  <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: isDark ? "#F3F4F6" : "#1A2024", fontWeight: "600" }}>
                    {classLabel || "Campus Building"}
                  </Text>
                </View>
              </View>

              {/* Divider */}
              <View style={{ alignSelf: "center", width: "95%", height: 3.5, borderRadius: 2, backgroundColor: isDark ? "#3A3A3C" : "#D9D9D9", marginVertical: 16 }} />

              {/* View Building Details */}
              {Building_Details_URL ? (
                <Pressable
                  style={{
                    backgroundColor: "#BF5700", height: 41.32, paddingHorizontal: 8,
                    borderRadius: 9.31, alignItems: "center", flexDirection: "row",
                    justifyContent: "center", marginBottom: 8,
                  }}
                  onPress={() => Linking.openURL(Building_Details_URL)}
                >
                  <Text style={{ fontFamily: "RobotoFlex", color: "white", fontSize: 16.79, fontWeight: "500" }}>
                    View Building Details
                  </Text>
                </Pressable>
              ) : null}

            </View>
          </BottomSheetScrollView>
        );
      }}
    </BottomSheetModal>
  );
};

export default BuildingBottomSheet;
