import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { booleanPointInPolygon } from "@turf/turf";
import React, { ForwardedRef, useEffect, useMemo, useState } from "react";
import { Text, View, Pressable, Image, ScrollView } from "react-native";
import Toast from "react-native-toast-message";

import buildingsData from '~/assets/geojson/buildings_simple.json';
import { Wheelchair, LocationPin, ChevronRight, InformationSym, Warning, Favorite } from "~/assets/map_icons/svg_icons";
import colors from "~/types/colors";
import { useBuildingRating } from "~/utils/api-hooks";
import { extractBuildingAbbreviation } from "~/utils/buildingDatabase";
import { useTheme } from "~/utils/ThemeContext";
import { typography } from '~/utils/typography';
import { mapIcons } from "~/utils/useMapIcons";
import { getCardinalLabel, getCardinalLabelFromNeighbors } from "~/utils/utils";


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


const isEntrancePoi = (entry: any) => {
  const poiType = String(entry?.poi_type ?? "").toLowerCase();
  return poiType.includes("entrance") && !poiType.includes("ramp");
};

const isRampPoi = (entry: any) => {
  const poiType = String(entry?.poi_type ?? "").toLowerCase();
  return poiType.includes("ramp") || Boolean(entry?.metadata?.ramp);
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
  handleReviews: (reviewData: POIReviewData) => void;
  onRequestPreview: (coords: [number, number], name: string, entrance?: string) => void;
}

interface POIContentProps {
  poi: any;
  allPOIs: any[];
  handleReviews: (reviewData: POIReviewData) => void;
  onRequestPreview: (coords: [number, number], name: string, entrance?: string) => void;
}

const POIContent = ({ poi, allPOIs, handleReviews, onRequestPreview }: POIContentProps) => {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const [selectedEntrance, setSelectedEntrance] = useState<string>("");
  const [entrances, setEntrances] = useState<any[]>([]);
  const [curEntranceLabel, setCurEntranceLabel] = useState<string>("");

  const buildingPoiIds = useMemo(() => {
    const ids = entrances
      .map((entrance) => Number(entrance.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    const selfId = Number(poi?.id);
    if (Number.isFinite(selfId) && selfId > 0 && !ids.includes(selfId)) {
      ids.push(selfId);
    }
    return ids;
  }, [entrances, poi?.id]);

  const { averageRating: rating, reviewCount } = useBuildingRating(buildingPoiIds);

  const renderWheelchairRating = (value: number, size: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <React.Fragment key={i}>
        <Wheelchair
          size={size}
          color={i < Math.round(value) ? colors.ut.burntorange : "#9CA3AF"}
        />
      </React.Fragment>
    ));
  };

  const metadata = poi.metadata || {};

  const formatBuildingName = (value?: string | null): string | null => {
    if (!value) return null;
    const cleaned = value.replace(/^\([A-Za-z0-9]+\)\s*/, "").trim();
    if (!cleaned) return null;
    return cleaned
      .toLowerCase()
      .split(/\s+/)
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getBuildingAbbr = (str?: string | null) => extractBuildingAbbreviation(str) ?? "";

  const findBuildingFeature = (abbreviation: string) => {
    if (!abbreviation) return null;
    return buildingsData.features.find(
      (f: any) => f.properties?.Building_Abbr === abbreviation
    ) ?? null;
  };

  const findBuildingContainingPoi = (entry: any) => {
    const coords = entry?.location_geojson?.coordinates;
    if (!coords?.length) return null;
    const point = { type: "Point", coordinates: [coords[0], coords[1]] };
    return (
      buildingsData.features.find((feature: any) =>
        feature?.geometry ? booleanPointInPolygon(point as any, feature as any) : false,
      ) ?? null
    );
  };

  const findNearestBuildingContainingPoi = (entry: any) => {
    const coords = entry?.location_geojson?.coordinates;
    if (!coords?.length) return null;
    const [lng, lat] = coords as [number, number];

    let nearest: any = null;
    let nearestDistanceSq = Number.POSITIVE_INFINITY;

    for (const feature of buildingsData.features as any[]) {
      const ring: [number, number][] = feature?.geometry?.coordinates?.[0] ?? [];
      if (!ring.length) continue;

      const centroid = ring.reduce(
        (acc, [x, y]) => {
          acc[0] += x;
          acc[1] += y;
          return acc;
        },
        [0, 0],
      );

      const centerLng = centroid[0] / ring.length;
      const centerLat = centroid[1] / ring.length;
      const dx = centerLng - lng;
      const dy = centerLat - lat;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearest = feature;
      }
    }

    const MAX_SNAP_DISTANCE_SQ = 0.002 * 0.002;
    return nearestDistanceSq <= MAX_SNAP_DISTANCE_SQ ? nearest : null;
  };

  const metadataAbbr =
    getBuildingAbbr(metadata.bld_name) ||
    getBuildingAbbr(metadata.name) ||
    getBuildingAbbr(metadata.building_abbr) ||
    getBuildingAbbr(metadata.Area_Description) ||
    getBuildingAbbr(metadata.building_name);
  const rampSelected = isRampPoi(poi);
  const buildingFeature =
    findBuildingFeature(metadataAbbr) ||
    findBuildingContainingPoi(poi) ||
    findNearestBuildingContainingPoi(poi);
  const building = buildingFeature?.properties ?? null;
  const buildingName =
    formatBuildingName(metadata.bld_name) ??
    formatBuildingName(metadata.building_name) ??
    formatBuildingName(building?.Description) ??
    formatBuildingName(metadata.name) ??
    "Unknown Building";

  useEffect(() => {
    const currentAbbr =
      getBuildingAbbr(metadata.bld_name) ||
      getBuildingAbbr(metadata.name) ||
      getBuildingAbbr(metadata.building_abbr) ||
      getBuildingAbbr(metadata.Area_Description) ||
      getBuildingAbbr(metadata.building_name);
    const currentBuildingName = normalizeText(buildingName);
    const fallbackName = normalizeText(metadata.name);

    const matched = allPOIs.filter((entry) => {
      if (!isEntrancePoi(entry)) return false;

      const entranceAbbr =
        getBuildingAbbr(entry.metadata?.bld_name) ||
        getBuildingAbbr(entry.metadata?.name);
      const entranceName = normalizeText(entry.metadata?.bld_name || entry.metadata?.name);

      return (
        (currentAbbr && entranceAbbr === currentAbbr) ||
        (buildingFeature ? isEntranceInsideBuilding(entry, buildingFeature) : false) ||
        (!!currentBuildingName && entranceName.includes(currentBuildingName)) ||
        (!!fallbackName && entranceName.includes(fallbackName))
      );
    });

    setEntrances(matched);
    if (rampSelected && poi?.id) {
      setSelectedEntrance(String(poi.id));
      setCurEntranceLabel("Ramp Access");
      return;
    }

    setSelectedEntrance(matched[0]?.id?.toString() ?? "");

    if (matched[0]) {
      const defaultLabel =
        getCardinalLabel(matched[0], buildingFeature) ??
        getCardinalLabelFromNeighbors(matched[0], matched) ??
        "Main Entrance";
      setCurEntranceLabel(defaultLabel);
      return;
    }

    setCurEntranceLabel("");
  }, [
    allPOIs,
    buildingFeature,
    buildingName,
    metadata.bld_name,
    metadata.name,
    metadata.Area_Description,
    metadata.building_abbr,
    metadata.building_name,
    poi?.id,
    rampSelected,
  ]);

  const openReviewsForCurrentEntrance = () => {
    const selectedEntranceData =
      entrances.find((entrance) => entrance.id.toString() === selectedEntrance) ??
      (!rampSelected ? entrances[0] : null) ??
      poi;

    const fallbackLabel =
      (rampSelected ? "Ramp Access" : curEntranceLabel) ||
      (selectedEntranceData
        ? getCardinalLabel(selectedEntranceData, buildingFeature) ??
          getCardinalLabelFromNeighbors(selectedEntranceData, entrances) ??
          "Main Entrance"
        : "Main Entrance");

    const resolvedPoiId = Number(selectedEntranceData?.id ?? poi.id);
    if (!Number.isFinite(resolvedPoiId) || !Number.isInteger(resolvedPoiId) || resolvedPoiId <= 0) {
      Toast.show({
        type: "error",
        text2: "This location cannot be reviewed yet because a valid entrance was not found.",
        position: "bottom",
        bottomOffset: 120,
      });
      return;
    }

    if (!buildingFeature || buildingName === "Unknown Building") {
      Toast.show({
        type: "error",
        text2: "We could not match this location to a campus building yet. Please choose another nearby entrance.",
        position: "bottom",
        bottomOffset: 120,
      });
      return;
    }

    handleReviews({
      id: resolvedPoiId,
      building: buildingFeature,
      buildingName,
      entrance: fallbackLabel,
      entrances,
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
            {buildingName}
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
            {renderWheelchairRating(rating, 23.6)}
          </View>
          <Text style={{ fontFamily: "Inter", fontSize: 15.35, fontWeight: "bold", marginRight: 24, color: isDark ? "#F3F4F6" : "#1A2024" }}>
            {rating.toFixed(1)}
          </Text>
        </View>

        {/* Reviews */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Pressable
            style={{ marginBottom: 16 }}
            onPress={openReviewsForCurrentEntrance}
          >
            <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: isDark ? "#9CA3AF" : "#64748B", fontWeight: "400" }}>
              Reviews ({reviewCount})
            </Text>
          </Pressable>
          <Pressable onPress={openReviewsForCurrentEntrance}>
            <ChevronRight />
          </Pressable>
        </View>

        {/* Hours + Distance */}
        <View style={{ flexDirection: "row", marginBottom: 8, alignItems: "center", gap: 16 }}>
          <View style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
            <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: isDark ? "#6B7280" : "#B3B3B3", fontWeight: "500" }}>Hours</Text>
            <Text style={{ fontFamily: "Inter", fontSize: 15.35, color: isDark ? "#F3F4F6" : "#1A2024", fontWeight: "600", maxWidth: 180 }}>
              Hours not available
            </Text>
          </View>
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
          {rampSelected ? (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontFamily: "Inter", fontSize: 14, color: isDark ? "#D1D5DB" : "#475569" }}>
                Reviewing ramp access. Entrance chips below remain available if you want to switch.
              </Text>
            </View>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 8 }}>
            {entrances.length > 0 ? entrances.map((entrance, idx) => {
              const cardinalLabel =
                getCardinalLabel(entrance, buildingFeature) ??
                getCardinalLabelFromNeighbors(entrance, entrances);

              const label = cardinalLabel ?? `Entrance ${idx + 1}`;
              const icon = entrance.metadata?.auto_opene ? mapIcons.autoDoor : mapIcons.manualDoor;

              return (
                <Pressable
                  key={entrance.id}
                  onPress={() => {
                    setSelectedEntrance(entrance.id.toString());
                    setCurEntranceLabel(label);
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

        {/* Get Directions button */}
        <Pressable
          onPress={() => {
            const activeEntrance = entrances.find((e) => e.id.toString() === selectedEntrance) ?? entrances[0];
            const coords: [number, number] = activeEntrance?.location_geojson?.coordinates
              ?? poi?.location_geojson?.coordinates
              ?? [-97.7335, 30.2861];
            onRequestPreview([coords[0], coords[1]], buildingName, curEntranceLabel);
          }}
          style={{
            backgroundColor: "#BF5700", height: 41.32, paddingHorizontal: 8,
            borderRadius: 9.31, alignItems: "center", flexDirection: "row",
            justifyContent: "center", marginBottom: 8,
          }}
        >
          <Text style={{ fontFamily: "RobotoFlex", color: "white", fontSize: 16.79, fontWeight: "700" }}>
            Get Directions
          </Text>
        </Pressable>
      </View>
    </BottomSheetScrollView>
  );
};

const POIBottomSheet = React.memo(({ ref, allPOIs, handleReviews, onRequestPreview }: POIBottomSheetProps) => {
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
        return (
          <POIContent
            poi={data.poi}
            allPOIs={allPOIs}
            handleReviews={handleReviews}
            onRequestPreview={onRequestPreview}
          />
        );
      }}
    </BottomSheetModal>
  );
});

export default POIBottomSheet;
