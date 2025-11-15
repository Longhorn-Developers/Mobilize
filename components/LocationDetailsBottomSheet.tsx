import { forwardRef, Ref } from "react";
import { View, Text, TouchableOpacity } from "react-native";
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

// Types for location data
interface EntranceAccess {
  hasPowerDoor?: boolean; // Yellow lightning icon
  hasRamp?: boolean; // Green ramp icon
  hasAccessibleRestroom?: boolean; // Blue restroom icon
  hasAccessibleDoor?: boolean; // Orange door icon
}

interface Entrance {
  id: string;
  name: string; // e.g., "North Entrance", "South Entrance"
  access: EntranceAccess;
}

interface LocationDetails {
  id: string;
  name: string;
  address: string;
  rating: number; // e.g., 4.2
  reviewCount: number; // e.g., 18
  hours?: string; // e.g., "7 AM to 10 PM"
  distance?: string; // e.g., "2.4 Mi"
  entrances: Entrance[];
}

// Empty props interface for now
interface LocationDetailsBottomSheetProps {}

const LocationDetailsBottomSheetComponent = (
  _props: LocationDetailsBottomSheetProps,
  ref: Ref<BottomSheetModal>
) => {
  const bottomTabBarHeight = useBottomTabBarHeight();

  // Mock data - will be replaced with actual location data
  const mockLocation: LocationDetails = {
    id: "1",
    name: "Texas Global",
    address: "2400 Nueces St",
    rating: 4.2,
    reviewCount: 18,
    hours: "7 AM to 10 PM",
    distance: "2.4 Mi",
    entrances: [
      {
        id: "north",
        name: "North Entrance",
        access: {
          hasPowerDoor: true,
          hasRamp: true,
        },
      },
      {
        id: "south",
        name: "South Entrance",
        access: {
          hasAccessibleDoor: true,
          hasRamp: true,
        },
      },
      {
        id: "west",
        name: "West Entrance",
        access: {
          hasRamp: true,
          hasAccessibleRestroom: true,
        },
      },
    ],
  };

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

  return (
    <BottomSheetModal
      ref={ref}
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
            {mockLocation.name}
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
          <Text className="text-lg text-gray-600">{mockLocation.address}</Text>
        </View>

        {/* Star Rating */}
        <View className="mb-2 flex-row items-center gap-2">
          {renderStars(mockLocation.rating)}
          <Text className="ml-1 text-xl font-semibold text-gray-900">
            {mockLocation.rating}
          </Text>
        </View>

        {/* Reviews */}
        <TouchableOpacity
          className="mb-4 flex-row items-center gap-2"
          activeOpacity={0.7}
        >
          <Text className="text-base text-gray-500">
            Reviews ({mockLocation.reviewCount})
          </Text>
          <CaretRightIcon size={16} color={colors.ut.gray} />
        </TouchableOpacity>

        {/* Hours and Distance */}
        <View className="mb-4 flex-row gap-8">
          {/* Hours */}
          <View className="flex-1">
            <Text className="mb-1 text-sm font-medium text-gray-500">
              Hours
            </Text>
            <Text className="text-lg font-semibold text-gray-900">
              {mockLocation.hours || "Not available"}
            </Text>
          </View>

          {/* Distance */}
          <View className="flex-1">
            <Text className="mb-1 text-sm font-medium text-gray-500">
              Distance
            </Text>
            <Text className="text-lg font-semibold text-gray-900">
              {mockLocation.distance || "N/A"}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View className="mb-4 h-px bg-gray-200" />

        {/* Access Section */}
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
            {mockLocation.entrances.map((entrance) => (
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