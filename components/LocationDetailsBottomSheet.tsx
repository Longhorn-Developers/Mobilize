import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { forwardRef, Ref, useImperativeHandle, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TouchableOpacity, View } from "react-native";
import {
  BookmarkSimpleIcon,
  WarningIcon,
  CaretRightIcon,
  MapPinIcon,
} from "phosphor-react-native";
import { StarFill, StarBorder } from "~/assets/map_icons/svg_icons";

import { Button } from "./Button";
import colors from "~/types/colors";
import type { PlaceDetails } from "~/utils/googlePlaces";
import { formatOpeningHours } from "~/utils/googlePlaces";

interface LocationDetailsBottomSheetProps {
  distance?: string;
}

export interface LocationDetailsBottomSheetRef {
  present: (placeDetails: PlaceDetails, distance?: string) => void;
  dismiss: () => void;
}

const LocationDetailsBottomSheetComponent = (
  props: LocationDetailsBottomSheetProps,
  ref: Ref<LocationDetailsBottomSheetRef>,
) => {
  const bottomTabBarHeight = useBottomTabBarHeight();
  const bottomSheetRef = useRef<BottomSheetModal>(null);

  const [placeData, setPlaceData] = useState<PlaceDetails | null>(null);
  const [distance, setDistance] = useState<string | undefined>(props.distance);

  useImperativeHandle(ref, () => ({
    present: (placeDetails: PlaceDetails, dist?: string) => {
      setPlaceData(placeDetails);
      setDistance(dist);
      bottomSheetRef.current?.present();
    },
    dismiss: () => {
      bottomSheetRef.current?.dismiss();
    },
  }));

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => {
      const StarComponent = i < Math.floor(rating) ? StarFill : StarBorder;

      return (
        <View key={i} style={{ marginHorizontal: 1 }}>
          <StarComponent width={23.6} height={23.6} />
        </View>
      );
    });
  };

  if (!placeData) {
    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        bottomInset={bottomTabBarHeight}
        backgroundStyle={{ borderRadius: 32 }}
        enableDynamicSizing={false}
        snapPoints={["50%"]}
        handleIndicatorStyle={{
          backgroundColor: colors.theme.majorgridline,
          width: 80,
        }}
      >
        <View className="flex-1 items-center justify-center p-8">
          <ActivityIndicator size="large" color={colors.ut.burntorange} />
          <Text className="mt-4 text-gray-500">Loading location details...</Text>
        </View>
      </BottomSheetModal>
    );
  }

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      bottomInset={bottomTabBarHeight}
      backgroundStyle={{ borderRadius: 32 }}
      enableDynamicSizing={false}
      snapPoints={["50%"]}
      handleIndicatorStyle={{
        backgroundColor: colors.theme.majorgridline,
        width: 80,
      }}
      enableContentPanningGesture={false}
    >
      <BottomSheetScrollView style={{ flex: 1 }}>
        <View style={{ padding: 24 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                flex: 1,
                paddingRight: 16,
                fontFamily: "Roboto Flex",
                fontWeight: "700",
                fontSize: 30.25,
                color: "#1A2024",
                marginBottom: 2,
              }}
            >
              {placeData.name}
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{
                  height: 40,
                  width: 40,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                activeOpacity={0.7}
              >
                <BookmarkSimpleIcon size={28} color={colors.ut.gray} />
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  height: 40,
                  width: 40,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                activeOpacity={0.7}
              >
                <WarningIcon size={28} color={colors.ut.gray} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <MapPinIcon size={20} color={colors.ut.gray} />
            <Text style={{ fontFamily: "Inter", fontWeight: "500", fontSize: 15.35, color: "#1A2024" }}>
              {placeData.formatted_address}
            </Text>
          </View>

          {placeData.rating && (
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
              <View style={{ flexDirection: "row", marginRight: 12 }}>
                {renderStars(placeData.rating)}
              </View>
              <Text style={{ fontFamily: "Inter", fontSize: 15.35, fontWeight: "bold", marginRight: 24, color: "#1A2024" }}>
                {placeData.rating.toFixed(1)}
              </Text>
            </View>
          )}

          {placeData.user_ratings_total && (
            <Pressable style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#64748B", fontWeight: "400" }}>
                  Reviews ({placeData.user_ratings_total})
                </Text>
              </View>
              <CaretRightIcon size={16} color={colors.ut.gray} />
            </Pressable>
          )}

          <View style={{ flexDirection: "row", marginBottom: 8, alignItems: "center", gap: 16 }}>
            <View style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
              <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#B3B3B3", fontWeight: "500" }}>Hours</Text>
              <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#1A2024", fontWeight: "600" }}>
                {formatOpeningHours(placeData.opening_hours)}
              </Text>
            </View>
            <View style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
              <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#B3B3B3", fontWeight: "500" }}>Distance</Text>
              <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#1A2024", fontWeight: "600" }}>
                {distance || "Calculating..."}
              </Text>
            </View>
          </View>

          <View style={{ alignSelf: "center", width: "95%", height: 3.5, borderRadius: 2, backgroundColor: "#D9D9D9", marginVertical: 16 }} />

          <View style={{ flexDirection: "row", marginBottom: 16, alignItems: "center", gap: 16 }}>
            <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#1A2024", fontWeight: "600" }}>Access</Text>
            <View style={{ height: 20, width: 20, alignItems: "center", justifyContent: "center", borderRadius: 9999, borderWidth: 1, borderColor: "#9CA3AF" }}>
              <Text style={{ fontSize: 12, color: "#4B5563" }}>i</Text>
            </View>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontFamily: "Inter", fontSize: 14, color: "#64748B" }}>
              No accessible entrances found.
            </Text>
          </View>

          <Button
            title="Get Directions"
            variant="primary"
            className="mb-2"
            onPress={() => console.log("Get Directions pressed")}
          />
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

export const LocationDetailsBottomSheet = forwardRef(LocationDetailsBottomSheetComponent);
