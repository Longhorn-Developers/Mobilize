import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { booleanPointInPolygon } from "@turf/turf";
import { ForwardedRef, useEffect, useState } from "react";
import { Text, View, Pressable, Image, ScrollView } from "react-native";
import { StarFill, StarBorder, LocationPin, ChevronRight, InformationSym, Warning, Favorite } from "~/assets/map_icons/svg_icons";
import useMapIcons from "~/utils/useMapIcons";
import { typography } from '~/utils/typography';
import colors from "~/types/colors";
import buildingsData from '../assets/geojson/buildings_simple.json';
import { searchPlaces, getPlaceDetails, formatOpeningHours, PlaceAutocompletePrediction, PlaceDetails } from "~/utils/googlePlaces";
import React from "react";
import { getCardinalLabel, getCardinalLabelFromNeighbors } from "~/utils/utils";
import { useTheme } from "~/utils/ThemeContext";

interface POIData {
  poi: any;
}

export interface POIReviewData {
  id: number;
  building: any;
  buildingName: string;
  entrance: string;
  entrances: any[];
}

const normalizeText = (value?: string | null) =>
  (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const extractBuildingAbbr = (value?: string | null): string | null => {
  if (!value) return null;

  const parenMatch = value.match(/\(([A-Za-z0-9]{2,6})\)/);
  if (parenMatch?.[1]) return parenMatch[1].toUpperCase();

  const leadingCodeMatch = value.match(/^([A-Za-z0-9]{2,6})\b/);
  if (leadingCodeMatch?.[1]) return leadingCodeMatch[1].toUpperCase();

  return null;
};

const isEntranceInsideBuilding = (entrance: any, buildingFeature: any): boolean => {
  const coords = entrance?.location_geojson?.coordinates;
  const polygonCoords = buildingFeature?.geometry?.coordinates;

  if (!coords || !polygonCoords) return false;

  const [lng, lat] = coords;
  const point = { type: "Point", coordinates: [lng, lat] };

  return booleanPointInPolygon(point as any, buildingFeature as any);
};

interface POIBottomSheetProps {
  ref: ForwardedRef<BottomSheetModal>;
  allPOIs: any[];
  handleReviews: () => void;
  setPoi: (poi: POIReviewData | undefined) => void;
}

interface POIContentProps {
  poi: any;
  allPOIs: any[];
  handleReviews: () => void;
  setPoi: (poi: POIReviewData | undefined) => void;
}

const POIContent = ({ poi, allPOIs, handleReviews, setPoi }: POIContentProps) => {
  const mapIcons = useMapIcons();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const [selectedEntrance, setSelectedEntrance] = useState<string>("");
  const [entrances, setEntrances] = useState<any[]>([]);
  const [curEntranceLabel, setCurEntranceLabel] = useState<string>("");
  const [hours, setHours] = useState<string>("Hours not available");
  const [rating] = useState<number>(0);
  const [reviewCount] = useState<number>(0);

  const renderStars = (value: number, size: number) => {
    return Array.from({ length: 5 }, (_, i) => {
      const StarComponent = i < Math.floor(value) ? StarFill : StarBorder;
      return (
        <React.Fragment key={i}>
          <StarComponent width={size} height={size} />
        </React.Fragment>
      );
    });
  };

  const metadata = poi.metadata || {};

  const configBuildingName = (str: string) => {
    return str ? str
      .substring(6)
      .toLowerCase()
      .split(' ')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') : "Unknown Building";
  };

  const getBuildingAbbr = (str: string) => {
    return extractBuildingAbbr(str) ?? "";
  };

  const findBuildingByAbbreviation = (abbreviation: string) => {
    const feature = buildingsData.features.find(
      (f: any) => f.properties?.Building_Abbr === abbreviation
    );
    return feature ? feature.properties : null;
  };

  const findBuildingFeature = (abbreviation: string) => {
    return buildingsData.features.find(
      (f: any) => f.properties?.Building_Abbr === abbreviation
    ) ?? null;
  };

  const buildingAbbr = getBuildingAbbr(metadata.bld_name);
  const buildingFeature = findBuildingFeature(buildingAbbr);
  const building = findBuildingByAbbreviation(buildingAbbr);

  useEffect(() => {
    const currentAbbr =
      getBuildingAbbr(metadata.bld_name) || getBuildingAbbr(metadata.name);
    const currentBuildingName = normalizeText(configBuildingName(metadata.bld_name));
    const fallbackName = normalizeText(metadata.name);

    if (currentAbbr && allPOIs.length) {
      const matched = allPOIs.filter((p) => {
        if (p.poi_type !== "accessible_entrance") return false;

        const entranceAbbr =
          getBuildingAbbr(p.metadata?.bld_name) || getBuildingAbbr(p.metadata?.name);
        const entranceName = normalizeText(p.metadata?.bld_name || p.metadata?.name);

        return (
          (currentAbbr && entranceAbbr === currentAbbr) ||
          (buildingFeature ? isEntranceInsideBuilding(p, buildingFeature) : false) ||
          (!!currentBuildingName && entranceName.includes(currentBuildingName)) ||
          (!!fallbackName && entranceName.includes(fallbackName))
        );
      });
      setEntrances(matched);
      setSelectedEntrance(matched[0]?.id?.toString() ?? "");

      // Set default poi data as soon as entrances load
      if (matched[0]) {
        const defaultLabel =
          getCardinalLabel(matched[0], buildingFeature) ??
          getCardinalLabelFromNeighbors(matched[0], matched) ??
          "Main Entrance";
        setCurEntranceLabel(defaultLabel);
      }
    } else if (allPOIs.length && buildingFeature) {
      const matchedByGeometry = allPOIs.filter(
        (p) => p.poi_type === "accessible_entrance" && isEntranceInsideBuilding(p, buildingFeature),
      );
      setEntrances(matchedByGeometry);
      setSelectedEntrance(matchedByGeometry[0]?.id?.toString() ?? "");
    } else {
      setEntrances([]);
    }

    const fetchHours = async () => {
        const buildingName = configBuildingName(metadata.bld_name);
        const searchQuery = buildingName !== "Unknown Building"
          ? `${buildingName} UT Austin`
          : building?.Address_Full;
        if (!searchQuery) {
          setHours("Hours not available");
          return;
        }
        // const predictions = await searchPlaces(searchQuery);
        const predictions: PlaceAutocompletePrediction[] = [{"description": "Texas Global at The University of Texas at Austin, Nueces Street, Austin, TX, USA", "place_id": "ChIJ5SpAob21RIYRT11gcy0lxGk", "structured_formatting": {"main_text": "Texas Global at The University of Texas at Austin, Nueces Street, Austin, TX, USA", "secondary_text": "Nueces Street, Austin, TX, USA"}}, {"description": "Texas Global Passport Services, Nueces Street, Austin, TX, USA", "place_id": "ChIJdQqBe3e1RIYRYlcWXB0LfOs", "structured_formatting": {"main_text": "Texas Global Passport Services, Nueces Street, Austin, TX, USA", "secondary_text": "Nueces Street, Austin, TX, USA"}}, {"description": "Global Auto Service, South 1st Street, Austin, Texas, USA", "place_id": "ChIJ_yNwDcK0RIYRILHOE9wmkXU", "structured_formatting": {"main_text": "Global Auto Service, South 1st Street, Austin, Texas, USA", "secondary_text": "South 1st Street, Austin, Texas, USA"}}, {"description": "UT Austin Global Sustainability Leadership Institute (GSLI), Building, Speedway, Austin, Texas, USA", "place_id": "ChIJwfBgVwC1RIYR0KeHkkuU39k", "structured_formatting": {"main_text": "UT Austin Global Sustainability Leadership Institute (GSLI), Building, Speedway, Austin, Texas, USA", "secondary_text": "Building, Speedway, Austin, Texas, USA"}}, {"description": "UT Austin Center for Global Business (CGB), Speedway, Austin, Texas, USA", "place_id": "ChIJ_7wtSQC1RIYRNpEunpRENwg", "structured_formatting": {"main_text": "UT Austin Center for Global Business (CGB), Speedway, Austin, Texas, USA", "secondary_text": "Speedway, Austin, Texas, USA"}}];
        if (!predictions.length) {
          setHours("Hours not available");
          return;
        }
        // const details = await getPlaceDetails(predictions[0].place_id);
        const details: PlaceDetails = {"formatted_address": "2400 Nueces St Suite B, Austin, TX 78705, USA", "geometry": {"location": {"lat": 30.2883838, "lng": -97.7434334}}, "name": "Texas Global at The University of Texas at Austin", "opening_hours": {"open_now": false, "weekday_text": ["Monday: 8:00 AM – 5:00 PM", "Tuesday: 8:00 AM – 5:00 PM", "Wednesday: 8:00 AM – 5:00 PM", "Thursday: 8:00 AM – 5:00 PM", "Friday: 8:00 AM – 5:00 PM", "Saturday: Closed", "Sunday: Closed"]}, "photos": [{"height": 600, "photo_reference": "places/ChIJ5SpAob21RIYRT11gcy0lxGk/photos/AU_ZVEETycqzGQt78dQ9OKgsaZ5Of5mcNsKiLGPx5tyrdwiMV5rkqey5kt_UqV9_nyb3tpqCcGhewVolb3GPvIc57JF3ch2MGX_uWkULCJHslMdqvQv0Wfx20s0nyg_otTsBP1WBmHTTmOEjSkesELcomhx9HHAWNNlOyWvCnF-l5Hu4oUnKQQWgYN7p6PeDNhKUFMxrhvKB_h_QY_sJZ-_bX3XzoA9_w5cIMohgazlJhLsTOOJ9Q183tF_nl6me6VfDH3P3hTJz6VjtOj1t7mR3LwCib4mOE5BRR_N4gAWd9OEX3A", "width": 1110}], "place_id": "ChIJ5SpAob21RIYRT11gcy0lxGk", "rating": 5, "types": ["academic_department", "point_of_interest", "establishment"], "user_ratings_total": 5};
        if (!details?.opening_hours) {
          setHours("Hours not available");
          return;
        }
        setHours(formatOpeningHours(details.opening_hours));
      };
      fetchHours();
    }, [poi.id]);

  interface EntranceProps {
    name: string;
    Icons: number[];
    selected: boolean;
  }

  const EntranceComponent = ({ name, Icons, selected }: EntranceProps) => (
    <View style={{
      width: 182, height: 82, borderRadius: 14, borderWidth: 2,
      borderColor: selected ? "#BF5700" : (isDark ? "#52525B" : "#333F4833"),
      backgroundColor: selected ? "#BF570033" : (isDark ? "#2C2C2E" : "#FFFFFF"),
      paddingHorizontal: 16, paddingVertical: 8, justifyContent: "center",
    }}>
      <Text style={{ fontSize: 14, color: selected ? "#BF5700" : (isDark ? "#9CA3AF" : "#64748B"), fontFamily: "Inter", fontWeight: "400", marginBottom: 8 }}>
        {name}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {Icons.map((iconSource, idx) => (
          <View key={idx} style={{ width: 35, height: 35, alignItems: "center", justifyContent: "center" }}>
            <Image source={iconSource} style={{ width: 60, height: 60, resizeMode: "contain" }} />
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <BottomSheetScrollView style={{ flex: 1 }}>
      <View style={{ padding: 24 }}>

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Text
            style={{ flex: 1, flexWrap: "wrap", fontFamily: "Roboto Flex", fontWeight: "700", fontSize: 30.25, color: isDark ? "#F3F4F6" : "#1A2024", marginBottom: 2 }}>
            {configBuildingName(metadata.bld_name)}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <Favorite />
            <Warning />
          </View>
        </View>

        {/* Address */}
        <View style={{ flexDirection: "row", marginBottom: 8, margin: 4, alignItems: "center", gap: 8 }}>
          <LocationPin />
          <Text style={{ fontFamily: typography.body.medium_strong.fontFamily, fontWeight: "500", fontSize: 15.35, color: isDark ? "#D1D5DB" : "#1A2024" }}>
            {building?.Address_Full || "UT Campus"}
          </Text>
        </View>

        {/* Rating */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
          <View style={{ flexDirection: "row", marginRight: 12 }}>
            {renderStars(rating, 23.6)}
          </View>
          <Text style={{ fontFamily: "Inter", fontSize: 15.35, fontWeight: "bold", marginRight: 24, color: isDark ? "#F3F4F6" : "#1A2024" }}>
            {rating.toFixed(1)}
          </Text>
        </View>

        {/* Reviews */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Pressable
            style={{ marginBottom: 16 }}
            onPress={() => {
              setPoi({
                id: Number(selectedEntrance),
                building: buildingFeature,
                buildingName: configBuildingName(metadata.bld_name),
                entrance: curEntranceLabel,
                entrances: entrances,
              });
              handleReviews();
            }}
          >
            <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: isDark ? "#9CA3AF" : "#64748B", fontWeight: "400" }}>
              Reviews ({reviewCount})
            </Text>
          </Pressable>
          <Pressable onPress={() => handleReviews()}>
            <ChevronRight />
          </Pressable>
        </View>

        {/* Hours + Distance */}
        <View style={{ flexDirection: "row", marginBottom: 8, alignItems: "center", gap: 16 }}>
          <View style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
            <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: isDark ? "#6B7280" : "#B3B3B3", fontWeight: "500" }}>Distance</Text>
            <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: isDark ? "#F3F4F6" : "#1A2024", fontWeight: "600" }}>On campus</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={{ alignSelf: "center", width: "95%", height: 3.5, borderRadius: 2, backgroundColor: isDark ? "#3A3A3C" : "#D9D9D9", marginVertical: 16 }} />

        {/* Access */}
        <View style={{ flexDirection: "row", marginBottom: 16, alignItems: "center", gap: 16 }}>
          <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: isDark ? "#F3F4F6" : "#1A2024", fontWeight: "600" }}>Access</Text>
          <InformationSym />
        </View>

        <View style={{ marginBottom: 16 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 8 }}>
            {entrances.length > 0 ? entrances.map((entrance, idx) => {
              const rawName = entrance.metadata?.name ?? "";
              const isUsefulName =
                rawName.length > 0 &&
                !rawName.match(/^(Point |kml_)/i) &&
                !rawName.match(/^\([A-Z]+\)\s+[A-Z\s]+$/);

              const cardinalLabel =
                getCardinalLabel(entrance, buildingFeature) ??
                getCardinalLabelFromNeighbors(entrance, entrances);

              const label = isUsefulName ? rawName : (cardinalLabel ?? `Entrance ${idx + 1}`);
              const icon = entrance.metadata?.auto_opene ? mapIcons.autoDoor : mapIcons.manualDoor;

              return (
                <Pressable
                  key={entrance.id}
                  onPress={() => {
                    setSelectedEntrance(entrance.id.toString());
                    setCurEntranceLabel(label);
                    setPoi({
                      id: entrance.id,
                      building: buildingFeature,
                      buildingName: configBuildingName(metadata.bld_name),
                      entrance: label,
                      entrances: entrances,
                    });
                  }}
                >
                  <EntranceComponent
                    name={label}
                    Icons={[icon]}
                    selected={selectedEntrance === entrance.id.toString()}
                  />
                </Pressable>
              );
            }) : (
              <Text style={{ fontFamily: "Inter", fontSize: 14, color: "#64748B" }}>
                No accessible entrances found.
              </Text>
            )}
          </ScrollView>
        </View>

        {/* Get Directions */}
        {/* TODO: Include searching logic here when we get it */}
        <Pressable style={{
          backgroundColor: "#BF5700", height: 41.32, paddingHorizontal: 8,
          borderRadius: 9.31, alignItems: "center", flexDirection: "row",
          justifyContent: "center", marginBottom: 8,
        }}>
          <Text style={{ fontFamily: "RobotoFlex", color: "white", fontSize: 16.79, fontWeight: "500" }}>
            Get Directions
          </Text>
        </Pressable>
      </View>
    </BottomSheetScrollView>
  );
};

const POIBottomSheet = React.memo(({ ref, allPOIs, handleReviews, setPoi }: POIBottomSheetProps) => {
  const bottomTabBarHeight = useBottomTabBarHeight();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  return (
    <BottomSheetModal<POIData>
      ref={ref}
      bottomInset={bottomTabBarHeight}
      backgroundStyle={{ borderRadius: 32, backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }}
      enableDynamicSizing={false}
      snapPoints={["50%"]}
      handleIndicatorStyle={{ backgroundColor: isDark ? "#52525B" : colors.theme.majorgridline, width: 80 }}
      enableContentPanningGesture={false}
    >

      {({ data }) => {
        if (!data?.poi) return null;
        return <POIContent
          poi={data.poi}
          allPOIs={allPOIs}
          handleReviews={handleReviews}
          setPoi={setPoi}
        />;
      }}
    </BottomSheetModal>
  );
});

export default POIBottomSheet;
