import { forwardRef, Ref, useImperativeHandle, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  BookmarkSimpleIcon,
  WarningIcon,
  MapPinIcon,
  LightningIcon,
  WheelchairIcon,
  ToiletIcon,
  DoorOpenIcon,
} from "phosphor-react-native";
import colors from "~/types/colors";
import { Button } from "./Button";
import type { PlaceDetails } from "~/utils/mapboxSearch";
import { useRef } from "react";
import { useTheme } from "~/utils/ThemeContext";

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
  distance?: string;
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
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  const [placeData, setPlaceData] = useState<PlaceDetails | null>(null);
  const [distance, setDistance] = useState<string | undefined>(props.distance);
  const [entrances, setEntrances] = useState<Entrance[]>([]);

  useImperativeHandle(ref, () => ({
    present: (placeDetails: PlaceDetails, dist?: string) => {
      setPlaceData(placeDetails);
      setDistance(dist);
      setEntrances([]);
      bottomSheetRef.current?.present();
    },
    dismiss: () => {
      bottomSheetRef.current?.dismiss();
    },
  }));

  const sheetBg = isDark ? "#1C1C1E" : "#FFFFFF";
  const handleColor = isDark ? "#52525B" : colors.theme.majorgridline;
  const dividerColor = isDark ? "#3A3A3C" : "#E5E7EB";
  const textPrimary = isDark ? "text-gray-100" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const textMuted = isDark ? "text-gray-500" : "text-gray-500";
  const emptyBg = isDark ? "bg-neutral-800" : "bg-gray-50";
  const cardBorder = isDark ? "border-neutral-700 bg-neutral-800" : "border-gray-200 bg-white";

  const renderAccessIcon = (access: EntranceAccess) => {
    const icons = [];
    if (access.hasPowerDoor)
      icons.push(<View key="power" className="h-10 w-10 items-center justify-center rounded-full bg-yellow-500"><LightningIcon size={20} weight="fill" color="white" /></View>);
    if (access.hasRamp)
      icons.push(<View key="ramp" className="h-10 w-10 items-center justify-center rounded-full bg-green-600"><WheelchairIcon size={20} weight="fill" color="white" /></View>);
    if (access.hasAccessibleRestroom)
      icons.push(<View key="restroom" className="h-10 w-10 items-center justify-center rounded-full bg-blue-500"><ToiletIcon size={20} weight="fill" color="white" /></View>);
    if (access.hasAccessibleDoor)
      icons.push(<View key="door" className="h-10 w-10 items-center justify-center rounded-full bg-ut-burntorange"><DoorOpenIcon size={20} weight="fill" color="white" /></View>);
    return icons;
  };

  const sheetProps = {
    ref: bottomSheetRef,
    bottomInset: bottomTabBarHeight,
    backgroundStyle: { borderRadius: 32, backgroundColor: sheetBg },
    enableDynamicSizing: false,
    snapPoints: ["50%", "85%"],
    handleIndicatorStyle: { backgroundColor: handleColor, width: 80 },
  };

  if (!placeData) {
    return (
      <BottomSheetModal {...sheetProps}>
        <View className="flex-1 items-center justify-center p-8">
          <ActivityIndicator size="large" color={colors.ut.burntorange} />
          <Text className={`mt-4 ${textMuted}`}>Loading location details...</Text>
        </View>
      </BottomSheetModal>
    );
  }

  return (
    <BottomSheetModal {...sheetProps}>
      <BottomSheetScrollView className="flex-1 px-6 py-4">
        {/* Header */}
        <View className="mb-4 flex-row items-start justify-between">
          <Text className={`flex-1 pr-4 text-3xl font-bold ${textPrimary}`}>
            {placeData.name}
          </Text>
          <View className="flex-row gap-3">
            <TouchableOpacity className="h-10 w-10 items-center justify-center" activeOpacity={0.7}>
              <BookmarkSimpleIcon size={28} color={isDark ? "#6B7280" : colors.ut.gray} />
            </TouchableOpacity>
            <TouchableOpacity className="h-10 w-10 items-center justify-center" activeOpacity={0.7}>
              <WarningIcon size={28} color={isDark ? "#6B7280" : colors.ut.gray} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Address */}
        <View className="mb-3 flex-row items-center gap-2">
          <MapPinIcon size={20} color={isDark ? "#6B7280" : colors.ut.gray} />
          <Text className={`text-lg ${textSecondary}`}>{placeData.formatted_address}</Text>
        </View>

        {/* Distance */}
        {distance && (
          <View className="mb-4">
            <Text className={`mb-1 text-sm font-medium ${textMuted}`}>Distance</Text>
            <Text className={`text-lg font-semibold ${textPrimary}`}>{distance}</Text>
          </View>
        )}

        <View style={{ height: 1, backgroundColor: dividerColor, marginBottom: 16 }} />

        {/* Access Section */}
        {entrances.length > 0 ? (
          <View className="mb-6">
            <View className="mb-3 flex-row items-center gap-2">
              <Text className={`text-lg font-semibold ${textPrimary}`}>Access</Text>
              <TouchableOpacity activeOpacity={0.7}>
                <View className="h-5 w-5 items-center justify-center rounded-full border border-gray-400">
                  <Text className="text-xs text-gray-600">i</Text>
                </View>
              </TouchableOpacity>
            </View>
            <View className="gap-3">
              {entrances.map((entrance) => (
                <View key={entrance.id} className={`rounded-2xl border-2 p-4 ${cardBorder}`}>
                  <Text className={`mb-3 text-base font-medium ${textSecondary}`}>{entrance.name}</Text>
                  <View className="flex-row gap-2">{renderAccessIcon(entrance.access)}</View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View className={`mb-6 rounded-xl p-4 ${emptyBg}`}>
            <Text className={`text-center ${textMuted}`}>
              No accessibility data available for this location yet.
            </Text>
            <TouchableOpacity className="mt-2">
              <Text className="text-center text-ut-burntorange">Add accessibility info</Text>
            </TouchableOpacity>
          </View>
        )}

        <Button title="Get Directions" variant="primary" className="mb-6" onPress={() => {}} />

        <View style={{ borderTopColor: dividerColor, borderTopWidth: 1 }} className="flex-row items-center justify-around py-4">
          {[colors.ut.burntorange + "33", "#E5E7EB", "#E5E7EB", "#E5E7EB"].map((bg, i) => (
            <TouchableOpacity key={i} className="items-center" activeOpacity={0.7}>
              <View className="h-8 w-8 rounded-lg" style={{ backgroundColor: isDark ? "#3A3A3C" : bg }} />
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

export const LocationDetailsBottomSheet = forwardRef(LocationDetailsBottomSheetComponent);
