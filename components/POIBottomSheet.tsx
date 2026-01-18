import { BottomSheetModal, BottomSheetView, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ForwardedRef, useCallback, useEffect, useState } from "react";
import { Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StarFill, StarBorder, Message, Warning, MapPin, LocationPin, ChevronRight, InformationSym } from "~/assets/map_icons/svg_icons";
import Svg, { Path } from 'react-native-svg';
import useMapIcons from "~/utils/useMapIcons";
import { typography } from '~/utils/typography';
import { Image } from "react-native";
import colors from "~/types/colors";
import { ScrollView } from "react-native";

interface POIData {
  poi: any;
}

interface POIBottomSheetProps {
  ref: ForwardedRef<BottomSheetModal>;
}

const POIBottomSheet = ({ ref }: POIBottomSheetProps) => {
  const bottomTabBarHeight = useBottomTabBarHeight();
  const [isReviewsOpen, setIsReviewsOpen] = useState(false);
  const [selectedEntrance, setSelectedEntrance] = useState<string>("");

  const configBuildingName = (str: string) => {
    return str ? str
      .substring(6)
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') : "Unknown Buliding";
  };

  // Mock data - replace with real data later
  const rating = 4.2;
  const reviewCount = 18;
  const reviews = [
    {
      id: 1,
      author: "@anonymous",
      rating: 3,
      time: "12h ago",
      text: "Clean and spacious, but door is a bit heavy."
    }
  ];

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
  
    for (let i = 0; i < 5; i++) {
      const StarComponent = i < fullStars ? StarFill : StarBorder;
      stars.push(
        <View key={i} style={{ marginHorizontal: 1 }}>
          <StarComponent width={23.608928680419922} height={22.428482055664062} />
        </View>
      );
    }
    return stars;
  };
  
  const mapIcons = useMapIcons();

  const getMapIcon = useCallback(
      (poiType: any, metadata: any) => {
        switch (poiType) {
          case "accessible_entrance":
            return metadata.auto_opene ? mapIcons.autoDoor : mapIcons.manualDoor;
          default:
            return undefined;
        }
      },
      [mapIcons],
    );

    interface EntranceProps {
      name: string;
      Icons: number[];
      selected: boolean;
    }
    
    const EntranceComponent = ({ name, Icons, selected }: EntranceProps) => {
      return (
        <View
          style={{
            width: 182,
            height: 82,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: selected ? "#BF5700" : "#333F4833",
            backgroundColor: selected ? "#BF570033" : "#FFFFFF",
            paddingHorizontal: 16,
            paddingVertical: 8,
            justifyContent: "center",
          }}
        >
          {/* Entrance name */}
          <Text
            style={{
              fontSize: 14,
              color: selected ? "#BF5700" : "#64748B",
              fontFamily: "Inter",
              fontWeight: "400",
              marginBottom: 8,
            }}
          >
            {name}
          </Text>
    
          {/* Horizontal row of icons */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              justifyContent: "flex-start",
            }}
          >
            {Icons.map((iconSource, idx) => (
              <View
                key={idx}
                style={{
                  width: 35,
                  height: 35,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Image
                  source={iconSource}
                  style={{
                    width: 60,
                    height: 60,
                    resizeMode: "contain",
                  }}
                />
              </View>
            ))}
          </View>
        </View>
      );
    };

  const renderReviewStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
  
    for (let i = 0; i < 5; i++) {
      const StarComponent = i < fullStars ? StarFill : StarBorder;
      stars.push(
        <View key={i} style={{ marginHorizontal: 1 }}>
          <StarComponent width={20} height={20} />
        </View>
      );
    }
    return stars;
  };

  return (
    <BottomSheetModal<POIData>
      ref={ref}
      bottomInset={bottomTabBarHeight}
      backgroundStyle={{ borderRadius: 32 }}
      enableDynamicSizing={false}
      snapPoints={["50%"]}
      handleIndicatorStyle={{
        backgroundColor: colors.theme.majorgridline,
        width: 80,
      }}
      onDismiss={() => setIsReviewsOpen(false)}
      enableContentPanningGesture={false}
    >
      {({ data }) => {
        if (!data || !data.poi) return null;
        const poi = data.poi;
        const metadata = poi.metadata || {};
        return (
          <BottomSheetScrollView style={{ flex: 1 }}>
            <View style={{ padding: 24 }}>

              {/* Header with Icon and Building Name */}
              <View style={{ flexDirection: "column", alignItems: "flex-start", marginBottom: 2 }}>
                <View style={{ flex: 1, flexDirection: "row" }}>
                <Text style={{
                    fontFamily: "Roboto Flex",
                    fontWeight: 700,
                    fontSize: 30.25,
                    color: "#1A2024"
                    
                  }}>
                    {configBuildingName(metadata.bld_name)}
                  </Text>
                </View>
              </View>
              {/* Subheader */}
              <View style={{ flexDirection: "row", marginBottom: 8, margin: 4, alignItems: "center", gap: 8}}>
                <LocationPin />
                <Text style={{
                  fontFamily: typography.body.medium_strong.fontFamily,
                  fontWeight: 500,
                  fontSize: 15.35,
                  color: "#1A2024",
                }}>
                  Testing
                </Text>
              </View>

              {/* Rating Section */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
                <View style={{ flexDirection: "row", marginRight: 12 }}>
                  {renderStars(rating)}
                </View>
                <Text style={{ fontFamily: "Inter", fontSize: 15.35, fontWeight: "bold", marginRight: 24, alignItems: "center", color: "#1A2024" }}>
                  {rating.toFixed(1)}
                </Text>
              </View>

              {/* Reviews Section */}
              <Pressable
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                onPress={() => setIsReviewsOpen(!isReviewsOpen)}
              >
                {/* Review Count */}
                <View style={{marginBottom: 16}}>
                  <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#64748B", fontWeight: 400 }}>
                    Reviews ({reviewCount})
                  </Text>
                </View>
                <ChevronRight/>
              </Pressable>

              {/* Buliding Details */}
              <View style={{ flexDirection: "row", marginBottom: 8, alignItems: "center", gap: 16}}>
                <View style={{ flexDirection: "column", alignItems: "flex-start", gap: 8}}>
                  <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#B3B3B3", fontWeight: 500 }}>
                    Hours
                  </Text>

                  <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#1A2024", fontWeight: 600 }}>
                    7 AM to 10 PM
                  </Text>
                </View>
                

                <View style={{ flexDirection: "column", alignItems: "flex-start", gap: 8}}>
                  <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#B3B3B3", fontWeight: 500 }}>
                    Distance
                  </Text>

                  <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#1A2024", fontWeight: 600 }}>
                    2.4 Mi
                  </Text>
                </View>
              </View>

              {/* Divider */}
              <View
                style={{
                  alignSelf: "center",
                  width: "95%",
                  height: 3.5,
                  borderRadius: 2,
                  backgroundColor: "#D9D9D9",
                  marginVertical: 16,
                }}
              />

              {/* Accessibility Features */}
              <View style={{ flexDirection: "row", marginBottom: 16, alignItems: "center", gap: 16}}>
                <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#1A2024", fontWeight: 600 }}>
                  Access
                </Text>
                <InformationSym/>
              </View>
              
              <View style={{ marginBottom: 16 }}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ flexDirection: "row", gap: 8 }}
                >
                  {["North Entrance", "South Entrance"].map((entrance) => (
                    <Pressable key={entrance} onPress={() => setSelectedEntrance(entrance)}>
                      <EntranceComponent
                        name={entrance}
                        Icons={[mapIcons.autoDoor, mapIcons.manualDoor]}
                        selected={selectedEntrance === entrance}
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Action Buttons */}
              <Pressable
                style={{
                  backgroundColor: "#BF5700",
                  height: 41.31562423706055,
                  paddingHorizontal: 8,
                  borderRadius: 9.31,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontFamily: "RobotoFlex", color: "white", fontSize: 16.79, fontWeight: "500" }}>
                  Get Directions
                </Text>
              </Pressable>
            </View>
          </BottomSheetScrollView>
        );
      }}
    </BottomSheetModal>
  );
};

export default POIBottomSheet;