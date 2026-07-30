import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { BookmarkSimpleIcon, WarningIcon, CaretRightIcon,
  MapPinIcon, LightningIcon, WheelchairIcon, ToiletIcon, DoorOpenIcon,
} from "phosphor-react-native";
import { forwardRef, Ref, useImperativeHandle, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, TouchableOpacity, View } from "react-native";
import { StarFill, StarBorder } from "~/assets/map_icons/svg_icons";
import colors from "~/types/colors";
import type { PlaceDetails } from "~/utils/googlePlaces";
import { formatOpeningHours } from "~/utils/googlePlaces";
import { useTheme } from "~/utils/ThemeContext";
import { Button } from "./Button";

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
  present: (placeDetails: PlaceDetails, distance?: string, entrances?: Entrance[]) => void;
  dismiss: () => void;
}

const LocationDetailsBottomSheetComponent = (
  props: LocationDetailsBottomSheetProps,
  ref: Ref<LocationDetailsBottomSheetRef>,
) => {
  const bottomTabBarHeight = useBottomTabBarHeight();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  const [placeData, setPlaceData] = useState<PlaceDetails | null>(null);
  const [distance, setDistance] = useState<string | undefined>(props.distance);
  const [entrances, setEntrances] = useState<Entrance[]>([]);

  useImperativeHandle(ref, () => ({
    present: (placeDetails: PlaceDetails, dist?: string, ents?: Entrance[]) => {
      setPlaceData(placeDetails);
      setDistance(dist);
      setEntrances(ents ?? []);
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

  const renderAccessIcons = (access: EntranceAccess) => {
    const icons = [];
    if (access.hasPowerDoor)
      icons.push(
        <View key="power" style={{ height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#EAB308" }}>
          <LightningIcon size={20} weight="fill" color="white" />
        </View>
      );
    if (access.hasRamp)
      icons.push(
        <View key="ramp" style={{ height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#16A34A" }}>
          <WheelchairIcon size={20} weight="fill" color="white" />
        </View>
      );
    if (access.hasAccessibleRestroom)
      icons.push(
        <View key="restroom" style={{ height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#3B82F6" }}>
          <ToiletIcon size={20} weight="fill" color="white" />
        </View>
      );
    if (access.hasAccessibleDoor)
      icons.push(
        <View key="door" style={{ height: 40, width: 40, alignItems: "center", justifyContent: "center", borderRadius: 20, backgroundColor: "#BF5700" }}>
          <DoorOpenIcon size={20} weight="fill" color="white" />
        </View>
      );
    return icons;
  };

  const sheetBg = isDark ? "#1C1C1E" : "#FFFFFF";
  const handleColor = isDark ? "#52525B" : colors.theme.majorgridline;
  const textPrimary = isDark ? "#F9FAFB" : "#1A2024";
  const textSecondary = isDark ? "#9CA3AF" : "#64748B";
  const iconColor = isDark ? "#6B7280" : colors.ut.gray;
  const dividerColor = isDark ? "#3A3A3C" : "#D9D9D9";
  const cardBg = isDark ? "#2C2C2E" : "#F9FAFB";
  const cardBorderColor = isDark ? "#3A3A3C" : "#E5E7EB";

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
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <ActivityIndicator size="large" color={colors.ut.burntorange} />
          <Text style={{ marginTop: 16, color: textSecondary }}>Loading location details...</Text>
        </View>
      </BottomSheetModal>
    );
  }

  return (
    <BottomSheetModal
      {...sheetProps}
      enableContentPanningGesture={false}
    >
      <BottomSheetScrollView style={{ flex: 1 }}>
        <View style={{ padding: 24 }}>
          {/* Header */}
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
                color: textPrimary,
                marginBottom: 2,
              }}
            >
              {placeData.name}
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{ height: 40, width: 40, alignItems: "center", justifyContent: "center" }}
                activeOpacity={0.7}
              >
                <BookmarkSimpleIcon size={28} color={iconColor} />
              </TouchableOpacity>
              <TouchableOpacity
                style={{ height: 40, width: 40, alignItems: "center", justifyContent: "center" }}
                activeOpacity={0.7}
              >
                <WarningIcon size={28} color={iconColor} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Address */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <MapPinIcon size={20} color={iconColor} />
            <Text style={{ fontFamily: "Inter", fontWeight: "500", fontSize: 15.35, color: textPrimary }}>
              {placeData.formatted_address}
            </Text>
          </View>

          {/* Rating */}
          {placeData.rating && (
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
              <View style={{ flexDirection: "row", marginRight: 12 }}>
                {renderStars(placeData.rating)}
              </View>
              <Text style={{ fontFamily: "Inter", fontSize: 15.35, fontWeight: "bold", marginRight: 24, color: textPrimary }}>
                {placeData.rating.toFixed(1)}
              </Text>
            </View>
          )}

          {/* Review count */}
          {placeData.user_ratings_total && (
            <Pressable style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: textSecondary, fontWeight: "400" }}>
                  Reviews ({placeData.user_ratings_total})
                </Text>
              </View>
              <CaretRightIcon size={16} color={iconColor} />
            </Pressable>
          )}

          {/* Hours & Distance */}
          <View style={{ flexDirection: "row", marginBottom: 8, alignItems: "center", gap: 16 }}>
            <View style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
              <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#B3B3B3", fontWeight: "500" }}>Hours</Text>
              <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: textPrimary, fontWeight: "600" }}>
                {formatOpeningHours(placeData.opening_hours)}
              </Text>
            </View>
            <View style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
              <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#B3B3B3", fontWeight: "500" }}>Distance</Text>
              <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: textPrimary, fontWeight: "600" }}>
                {distance || "Calculating..."}
              </Text>
            </View>
          </View>

          <View style={{ alignSelf: "center", width: "95%", height: 3.5, borderRadius: 2, backgroundColor: dividerColor, marginVertical: 16 }} />

          {/* Access / Entrances */}
          <View style={{ flexDirection: "row", marginBottom: 16, alignItems: "center", gap: 16 }}>
            <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: textPrimary, fontWeight: "600" }}>Access</Text>
            <View style={{ height: 20, width: 20, alignItems: "center", justifyContent: "center", borderRadius: 9999, borderWidth: 1, borderColor: "#9CA3AF" }}>
              <Text style={{ fontSize: 12, color: "#4B5563" }}>i</Text>
            </View>
          </View>

          {entrances.length > 0 ? (
            <View style={{ gap: 12, marginBottom: 16 }}>
              {entrances.map((entrance) => (
                <View
                  key={entrance.id}
                  style={{
                    borderRadius: 16,
                    borderWidth: 2,
                    borderColor: cardBorderColor,
                    backgroundColor: cardBg,
                    padding: 16,
                  }}
                >
                  <Text style={{ fontFamily: "Inter", fontSize: 15.35, fontWeight: "500", color: textSecondary, marginBottom: 12 }}>
                    {entrance.name}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {renderAccessIcons(entrance.access)}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontFamily: "Inter", fontSize: 14, color: textSecondary }}>
                No accessible entrances found.
              </Text>
            </View>
          )}

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
