// 

import { useCallback } from "react";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

import { type LocationDetailsBottomSheetRef } from "~/src/features/components/LocationDetailsBottomSheet";
import { type SidewalkSegment } from "~/src/features/components/SidewalkBottomSheet";
import { buildingToPlaceDetails, findBuilding } from "~/utils/buildingDatabase";
import { findCampusBuildingFeature } from "~/src/features/pois/buildingUtils";
import { buildPoiFromCampusBuilding } from "~/src/features/pois/poiBuildingUtils";

import buildingsData from "~/assets/geojson/buildings_simple.json";

type UseMapPressHandlersParams = {
  isReportMode: boolean;
  entrances: any[];
  avoidanceAreas: any[] | undefined;
  locationBottomSheet: React.RefObject<LocationDetailsBottomSheetRef | null>;
  poiBottomSheet: React.RefObject<BottomSheetModal | null>;
  avoidanceAreaBottomSheet: React.RefObject<BottomSheetModal | null>;
  sidewalkBottomSheet: React.RefObject<BottomSheetModal | null>;
  barrierBottomSheet: React.RefObject<BottomSheetModal | null>;
  constructionBottomSheet: React.RefObject<BottomSheetModal | null>;
};

export function useMapPressHandlers({
  isReportMode,
  entrances,
  avoidanceAreas,
  locationBottomSheet,
  poiBottomSheet,
  avoidanceAreaBottomSheet,
  sidewalkBottomSheet,
  barrierBottomSheet,
  constructionBottomSheet,
}: UseMapPressHandlersParams) {

  const handleRampPress = useCallback((feature: GeoJSON.Feature) => {
    if (isReportMode) return;

    const geometry = feature.geometry as GeoJSON.Point | null;
    if (!geometry || geometry.type !== "Point") return;
    const [lng, lat] = geometry.coordinates as [number, number];
    const properties = (feature.properties ?? {}) as Record<string, any>;
    const rampAreaAbbr = String(properties.Area_Description ?? "").toUpperCase();

    const features = ((buildingsData as any).features ?? []) as any[];
    const buildingMatchByAbbreviation = rampAreaAbbr
      ? features.find((entry) => String(entry?.properties?.Building_Abbr ?? "").toUpperCase() === rampAreaAbbr)
      : null;
    const buildingFeature =
      buildingMatchByAbbreviation ?? findCampusBuildingFeature(lat, lng);
    if (!buildingFeature) return;

    const buildingPoi = buildPoiFromCampusBuilding(
      entrances,
      {
        place_id: `ramp-${properties.ObjectId ?? properties.GlobalID ?? feature.id ?? "unknown"}`,
        geometry: { location: { lat, lng } },
      },
      buildingFeature,
    );

    if (buildingPoi) {
      locationBottomSheet.current?.dismiss();
      poiBottomSheet.current?.present({ poi: buildingPoi });
    }
  }, [isReportMode, entrances, locationBottomSheet, poiBottomSheet]);

  const handleBuildingTap = useCallback((feature: GeoJSON.Feature) => {
    if (isReportMode) return;

    const buildingPoi = buildPoiFromCampusBuilding(entrances, null, feature);
    if (buildingPoi) {
      locationBottomSheet.current?.dismiss();
      poiBottomSheet.current?.present({ poi: buildingPoi });
      return;
    }

    const props = feature.properties as { Building_Abbr?: string } | null;
    const building = props?.Building_Abbr ? findBuilding(props.Building_Abbr) : null;
    if (!building) return;
    locationBottomSheet.current?.present(buildingToPlaceDetails(building));
  }, [isReportMode, entrances, locationBottomSheet, poiBottomSheet]);

  const handleAvoidanceAreaPress = useCallback((polygonId: string) => {
    const area = (avoidanceAreas ?? []).find((a: any) => String(a.id) === polygonId);
    if (!area) return;
    avoidanceAreaBottomSheet.current?.present({ area });
  }, [avoidanceAreas, avoidanceAreaBottomSheet]);

  const handleSidewalkPress = useCallback((segment: SidewalkSegment) => {
    sidewalkBottomSheet.current?.present({ segment });
  }, [sidewalkBottomSheet]);

  const handlePOIPress = useCallback((poi: any) => {
    poiBottomSheet.current?.present({ poi });
  }, [poiBottomSheet]);

  const handleBarrierPress = useCallback((properties: Record<string, any>) => {
    barrierBottomSheet.current?.present({ barrier: properties });
  }, [barrierBottomSheet]);

  const handleConstructionPress = useCallback((id: string, description?: string) => {
    constructionBottomSheet.current?.present({ construction: { id, description } });
  }, [constructionBottomSheet]);

  return {
    action: {
      handleRampPress,
      handleBuildingTap,
      handleAvoidanceAreaPress,
      handleSidewalkPress,
      handlePOIPress,
      handleBarrierPress,
      handleConstructionPress,
    },
  };
}