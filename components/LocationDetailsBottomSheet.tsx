import { forwardRef, Ref, useImperativeHandle, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  BookmarkSimpleIcon,
  WarningIcon,
  StarIcon,
  CaretRightIcon,
  MapPinIcon,
  LightningIcon,
  WheelchairIcon,
  ToiletIcon,
  DoorOpenIcon,
} from "phosphor-react-native";
import colors from "~/types/colors";
import { Button } from "./Button";
import type { PlaceDetails } from "~/utils/googlePlaces";
import { formatOpeningHours } from "~/utils/googlePlaces";
import { useRef } from "react";

// Types for location data
interface EntranceAccess {
  hasPowerDoor?: boolean;
  hasRamp?: boolean;
  hasAccessibleRestroom?: boolean;
  hasAccessibleDoor?: boolean;
}

interface Entrance {
  id: string;
  name: string;
  access: EntranceAccess;
}

interface LocationDetailsBottomSheetProps {
  distance?: string; // e.g., "2.4 Mi"
}

export interface LocationDetailsBottomSheetRef {
  present: (placeDetails: PlaceDetails, distance?: string) => void;
  dismiss: () => void;
}

const LocationDetailsBottomSheetComponent = (
  props: LocationDetailsBottomSheetProps,
  ref: Ref<LocationDetailsBottomSheetRef>
) => {
  const bottomTabBarHeight = useBottomTabBarHeight();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  
  const [placeData, setPlaceData] = useState<PlaceDetails | null>(null);
  const [distance, setDistance] = useState<string | undefined>(props.distance);
  const [entrances, setEntrances] = useState<Entrance[]>([]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    present: (placeDetails: PlaceDetails, dist?: string) => {
      setPlaceData(placeDetails);
      setDistance(dist);
      // TODO: Fetch entrances from Cloudflare based on coordinates
      setEntrances([]); // Empty for now
      bottomSheetRef.current?.present();
    },
    dismiss: () => {
      bottomSheetRef.current?.dismiss();
    },
  }));

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);

    for (let i = 0; i < 5; i++) {
      stars.push(
        <StarIcon
          key={i}
          size={24}
          weight={i < fullStars ? "fill" : "regular"}
          color={i < fullStars ? colors.ut.yellow : colors.ut.gray}
        />
      );
    }

    return stars;
  };

  const renderAccessIcon = (access: EntranceAccess) => {
    const icons = [];

    if (access.hasPowerDoor) {
      icons.push(
        <View
          key="power"
          className="h-10 w-10 items-center justify-center rounded-full bg-yellow-500"
        >
          <LightningIcon size={20} weight="fill" color="white" />
        </View>
      );
    }

    if (access.hasRamp) {
      icons.push(
        <View
          key="ramp"
          className="h-10 w-10 items-center justify-center rounded-full bg-green-600"
        >
          <WheelchairIcon size={20} weight="fill" color="white" />
        </View>
      );
    }

    if (access.hasAccessibleRestroom) {
      icons.push(
        <View
          key="restroom"
          className="h-10 w-10 items-center justify-center rounded-full bg-blue-500"
        >
          <ToiletIcon size={20} weight="fill" color="white" />
        </View>
      );
    }

    if (access.hasAccessibleDoor) {
      icons.push(
        <View
          key="door"
          className="h-10 w-10 items-center justify-center rounded-full bg-ut-burntorange"
        >
          <DoorOpenIcon size={20} weight="fill" color="white" />
        </View>
      );
    }

    return icons;
  };

  if (!placeData) {
    return (
      <BottomSheetModal
        ref={bottomSheetRef}
        bottomInset={bottomTabBarHeight}
        backgroundStyle={{ borderRadius: 32 }}
        enableDynamicSizing={false}
        snapPoints={["50%", "85%"]}
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
      snapPoints={["50%", "85%"]}
      handleIndicatorStyle={{
        backgroundColor: colors.theme.majorgridline,
        width: 80,
      }}
    >
      <BottomSheetScrollView className="flex-1 px-6 py-4">
        {/* Header: Title and Action Icons */}
        <View className="mb-4 flex-row items-start justify-between">
          <Text className="flex-1 pr-4 text-3xl font-bold text-gray-900">
            {placeData.name}
          </Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              className="h-10 w-10 items-center justify-center"
              activeOpacity={0.7}
            >
              <BookmarkSimpleIcon size={28} color={colors.ut.gray} />
            </TouchableOpacity>
            <TouchableOpacity
              className="h-10 w-10 items-center justify-center"
              activeOpacity={0.7}
            >
              <WarningIcon size={28} color={colors.ut.gray} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Address */}
        <View className="mb-3 flex-row items-center gap-2">
          <MapPinIcon size={20} color={colors.ut.gray} />
          <Text className="text-lg text-gray-600">{placeData.formatted_address}</Text>
        </View>

        {/* Star Rating */}
        {placeData.rating && (
          <View className="mb-2 flex-row items-center gap-2">
            {renderStars(placeData.rating)}
            <Text className="ml-1 text-xl font-semibold text-gray-900">
              {placeData.rating}
            </Text>
          </View>
        )}

        {/* Reviews */}
        {placeData.user_ratings_total && (
          <TouchableOpacity
            className="mb-4 flex-row items-center gap-2"
            activeOpacity={0.7}
          >
            <Text className="text-base text-gray-500">
              Reviews ({placeData.user_ratings_total})
            </Text>
            <CaretRightIcon size={16} color={colors.ut.gray} />
          </TouchableOpacity>
        )}

        {/* Hours and Distance */}
        <View className="mb-4 flex-row gap-8">
          {/* Hours */}
          <View className="flex-1">
            <Text className="mb-1 text-sm font-medium text-gray-500">Hours</Text>
            <Text className="text-lg font-semibold text-gray-900">
              {formatOpeningHours(placeData.opening_hours)}
            </Text>
          </View>

          {/* Distance */}
          <View className="flex-1">
            <Text className="mb-1 text-sm font-medium text-gray-500">Distance</Text>
            <Text className="text-lg font-semibold text-gray-900">
              {distance || "Calculating..."}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View className="mb-4 h-px bg-gray-200" />

        {/* Access Section - Only show if we have entrance data */}
        {entrances.length > 0 ? (
          <View className="mb-6">
            <View className="mb-3 flex-row items-center gap-2">
              <Text className="text-lg font-semibold text-gray-900">Access</Text>
              <TouchableOpacity activeOpacity={0.7}>
                <View className="h-5 w-5 items-center justify-center rounded-full border border-gray-400">
                  <Text className="text-xs text-gray-600">i</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Entrances */}
            <View className="gap-3">
              {entrances.map((entrance) => (
                <View
                  key={entrance.id}
                  className="rounded-2xl border-2 border-gray-200 bg-white p-4"
                >
                  <Text className="mb-3 text-base font-medium text-gray-700">
                    {entrance.name}
                  </Text>
                  <View className="flex-row gap-2">
                    {renderAccessIcon(entrance.access)}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View className="mb-6 rounded-xl bg-gray-50 p-4">
            <Text className="text-center text-gray-500">
              No accessibility data available for this location yet.
            </Text>
            <TouchableOpacity className="mt-2">
              <Text className="text-center text-ut-burntorange">
                Add accessibility info
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Get Directions Button */}
        <Button
          title="Get Directions"
          variant="primary"
          className="mb-6"
          onPress={() => console.log("Get Directions pressed")}
        />

        {/* Bottom Navigation Icons (placeholder for now) */}
        <View className="flex-row items-center justify-around border-t border-gray-200 py-4">
          <TouchableOpacity className="items-center" activeOpacity={0.7}>
            <View className="h-8 w-8 rounded-lg bg-ut-burntorange/20" />
          </TouchableOpacity>
          <TouchableOpacity className="items-center" activeOpacity={0.7}>
            <View className="h-8 w-8 rounded-lg bg-gray-200" />
          </TouchableOpacity>
          <TouchableOpacity className="items-center" activeOpacity={0.7}>
            <View className="h-8 w-8 rounded-lg bg-gray-200" />
          </TouchableOpacity>
          <TouchableOpacity className="items-center" activeOpacity={0.7}>
            <View className="h-8 w-8 rounded-lg bg-gray-200" />
          </TouchableOpacity>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

export const LocationDetailsBottomSheet = forwardRef(LocationDetailsBottomSheetComponent);