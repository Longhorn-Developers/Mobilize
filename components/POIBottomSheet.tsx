import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ForwardedRef, useCallback, useEffect, useState } from "react";
import { Text, View, Pressable, Image, ScrollView } from "react-native";
import { StarFill, StarBorder, LocationPin, ChevronRight, InformationSym } from "~/assets/map_icons/svg_icons";
import useMapIcons from "~/utils/useMapIcons";
import { typography } from '~/utils/typography';
import colors from "~/types/colors";
import buildingsData from '../assets/geojson/buildings_simple.json';
import { searchPlaces, getPlaceDetails, formatOpeningHours } from "~/utils/googlePlaces";

interface POIData {
  poi: any;
}


/* Helper functions to get direction based buliding names */ 
const getCardinalLabel = (entrance: any, buildingFeature: any): string | null => {
  if (!entrance.location_geojson?.coordinates || !buildingFeature?.geometry?.coordinates) return null;

  const [eLng, eLat] = entrance.location_geojson.coordinates;
  const coords: [number, number][] = buildingFeature.geometry.coordinates[0];
  const centroidLng = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
  const centroidLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;

  const dLat = eLat - centroidLat;
  const dLng = eLng - centroidLng;

  const angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
  const normalized = (angle + 360) % 360;

  if (normalized >= 337.5 || normalized < 22.5) return "North Entrance";
  if (normalized < 67.5) return "Northeast Entrance";
  if (normalized < 112.5) return "East Entrance";
  if (normalized < 157.5) return "Southeast Entrance";
  if (normalized < 202.5) return "South Entrance";
  if (normalized < 247.5) return "Southwest Entrance";
  if (normalized < 292.5) return "West Entrance";
  return "Northwest Entrance";
};

const getCardinalLabelFromNeighbors = (entrance: any, neighbors: any[]): string | null => {
  if (!entrance.location_geojson?.coordinates || neighbors.length < 2) return null;

  const [eLng, eLat] = entrance.location_geojson.coordinates;
  const validNeighbors = neighbors.filter(p => p.location_geojson?.coordinates);
  if (!validNeighbors.length) return null;

  const centroidLng = validNeighbors.reduce((sum, p) => sum + p.location_geojson.coordinates[0], 0) / validNeighbors.length;
  const centroidLat = validNeighbors.reduce((sum, p) => sum + p.location_geojson.coordinates[1], 0) / validNeighbors.length;

  const dLat = eLat - centroidLat;
  const dLng = eLng - centroidLng;
  if (Math.abs(dLat) < 0.00001 && Math.abs(dLng) < 0.00001) return null;

  const angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
  const normalized = (angle + 360) % 360;

  if (normalized >= 337.5 || normalized < 22.5) return "North Entrance";
  if (normalized < 67.5) return "Northeast Entrance";
  if (normalized < 112.5) return "East Entrance";
  if (normalized < 157.5) return "Southeast Entrance";
  if (normalized < 202.5) return "South Entrance";
  if (normalized < 247.5) return "Southwest Entrance";
  if (normalized < 292.5) return "West Entrance";
  return "Northwest Entrance";
};

interface POIBottomSheetProps {
  ref: ForwardedRef<BottomSheetModal>;
  allPOIs: any[];
}

interface POIContentProps {
  poi: any;
  allPOIs: any[];
}

const POIContent = ({ poi, allPOIs }: POIContentProps) => {
  const mapIcons = useMapIcons();
  const [selectedEntrance, setSelectedEntrance] = useState<string>("");
  const [hours, setHours] = useState<string>("Loading...");
  const [entrances, setEntrances] = useState<any[]>([]);

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
    return str ? str.substring(1, 4).toUpperCase() : "";
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
      getBuildingAbbr(metadata.bld_name) ?? getBuildingAbbr(metadata.name);

    if (currentAbbr && allPOIs.length) {
      const matched = allPOIs.filter((p) => {
        if (p.poi_type !== "accessible_entrance") return false;
        return (
          getBuildingAbbr(p.metadata?.bld_name) === currentAbbr ||
          getBuildingAbbr(p.metadata?.name) === currentAbbr
        );
      });
      setEntrances(matched);
      setSelectedEntrance(matched[0]?.id?.toString() ?? "");
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
        const predictions = await searchPlaces(searchQuery);
        if (!predictions.length) {
          setHours("Hours not available"); 
          return; 
        }
        const details = await getPlaceDetails(predictions[0].place_id);
        if (!details?.opening_hours) {
          setHours("Hours not available");
          return;
        }
        setHours(formatOpeningHours(details.opening_hours));
      };
      fetchHours();
    }, [poi.id]);

  const rating = 4.2;
  const reviewCount = 18;

  const renderStars = (rating: number, size: number) => {
    return Array.from({ length: 5 }, (_, i) => {
      const StarComponent = i < Math.floor(rating) ? StarFill : StarBorder;
      return (
        <View key={i} style={{ marginHorizontal: 1 }}>
          <StarComponent width={size} height={size} />
        </View>
      );
    });
  };

  interface EntranceProps {
    name: string;
    Icons: number[];
    selected: boolean;
  }

  const EntranceComponent = ({ name, Icons, selected }: EntranceProps) => (
    <View style={{
      width: 182, height: 82, borderRadius: 14, borderWidth: 2,
      borderColor: selected ? "#BF5700" : "#333F4833",
      backgroundColor: selected ? "#BF570033" : "#FFFFFF",
      paddingHorizontal: 16, paddingVertical: 8, justifyContent: "center",
    }}>
      <Text style={{ fontSize: 14, color: selected ? "#BF5700" : "#64748B", fontFamily: "Inter", fontWeight: "400", marginBottom: 8 }}>
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
        <Text style={{ fontFamily: "Roboto Flex", fontWeight: "700", fontSize: 30.25, color: "#1A2024", marginBottom: 2 }}>
          {configBuildingName(metadata.bld_name)}
        </Text>

        {/* Address */}
        <View style={{ flexDirection: "row", marginBottom: 8, margin: 4, alignItems: "center", gap: 8 }}>
          <LocationPin />
          <Text style={{ fontFamily: typography.body.medium_strong.fontFamily, fontWeight: "500", fontSize: 15.35, color: "#1A2024" }}>
            {building?.Address_Full || "UT Campus"}
          </Text>
        </View>

        {/* Rating */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
          <View style={{ flexDirection: "row", marginRight: 12 }}>
            {renderStars(rating, 23.6)}
          </View>
          <Text style={{ fontFamily: "Inter", fontSize: 15.35, fontWeight: "bold", marginRight: 24, color: "#1A2024" }}>
            {rating.toFixed(1)}
          </Text>
        </View>

        {/* Reviews */}
        {/* TODO: Include review logic here when implemented */}
        <Pressable style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#64748B", fontWeight: "400" }}>
              Reviews ({reviewCount})
            </Text>
          </View>
          <ChevronRight />
        </Pressable>

        {/* Hours + Distance */}
        <View style={{ flexDirection: "row", marginBottom: 8, alignItems: "center", gap: 16 }}>
          <View style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
            <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#B3B3B3", fontWeight: "500" }}>Hours</Text>
            <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#1A2024", fontWeight: "600" }}>{hours}</Text>
          </View>
          <View style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
            <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#B3B3B3", fontWeight: "500" }}>Distance</Text>
            <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#1A2024", fontWeight: "600" }}>2.4 Mi</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={{ alignSelf: "center", width: "95%", height: 3.5, borderRadius: 2, backgroundColor: "#D9D9D9", marginVertical: 16 }} />

        {/* Access */}
        <View style={{ flexDirection: "row", marginBottom: 16, alignItems: "center", gap: 16 }}>
          <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: "#1A2024", fontWeight: "600" }}>Access</Text>
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
                <Pressable key={entrance.id} onPress={() => setSelectedEntrance(entrance.id.toString())}>
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

const POIBottomSheet = ({ ref, allPOIs }: POIBottomSheetProps) => {
  const bottomTabBarHeight = useBottomTabBarHeight();

  return (
    <BottomSheetModal<POIData>
      ref={ref}
      bottomInset={bottomTabBarHeight}
      backgroundStyle={{ borderRadius: 32 }}
      enableDynamicSizing={false}
      snapPoints={["50%"]}
      handleIndicatorStyle={{ backgroundColor: colors.theme.majorgridline, width: 80 }}
      enableContentPanningGesture={false}
    >
      {({ data }) => {
        if (!data?.poi) return null;
        return <POIContent poi={data.poi} allPOIs={allPOIs} />;
      }}
    </BottomSheetModal>
  );
};

export default POIBottomSheet;