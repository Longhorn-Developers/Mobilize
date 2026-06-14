// Hook to handle map feature press events (buildings, ramps, POIs, sidewalks, barriers, etc.)

import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useCallback } from "react";
import Toast from "react-native-toast-message";

import buildingsData from "~/assets/geojson/buildings_simple.json";
import { type LocationDetailsBottomSheetRef } from "~/src/features/components/LocationDetailsBottomSheet";
import { type SidewalkSegment } from "~/src/features/components/SidewalkBottomSheet";
import { findCampusBuildingFeature } from "~/src/features/pois/buildingUtils";
import { buildPoiFromCampusBuilding } from "~/src/features/pois/poiBuildingUtils";
import { apiClient } from "~/utils/api-client";
import { buildingToPlaceDetails, findBuilding } from "~/utils/buildingDatabase";


type UseMapPressHandlersParams = {
  isReportMode: boolean;
  entrances: any[];
  avoidanceAreas: any[] | undefined;
  bottomTabBarHeight: number;
  locationBottomSheet: React.RefObject<LocationDetailsBottomSheetRef | null>;
  poiBottomSheet: React.RefObject<BottomSheetModal | null>;
  avoidanceAreaBottomSheet: React.RefObject<BottomSheetModal | null>;
  sidewalkBottomSheet: React.RefObject<BottomSheetModal | null>;
  barrierBottomSheet: React.RefObject<BottomSheetModal | null>;
  constructionBottomSheet: React.RefObject<BottomSheetModal | null>;
  /** From useMapOverlay */
  beginOverlayAction: () => number;
  canPresent: (epoch: number) => boolean;
  guardedPresent: (epoch: number, fn: () => void, name: string) => boolean;
  registerAbortController: () => AbortController;
  releaseAbortController: (c: AbortController) => void;
};

export function useMapPressHandlers({
  isReportMode,
  entrances,
  avoidanceAreas,
  bottomTabBarHeight,
  locationBottomSheet,
  poiBottomSheet,
  avoidanceAreaBottomSheet,
  sidewalkBottomSheet,
  barrierBottomSheet,
  constructionBottomSheet,
  beginOverlayAction,
  canPresent,
  guardedPresent,
  registerAbortController,
  releaseAbortController,
}: UseMapPressHandlersParams) {

  const handleRampPress = useCallback((feature: GeoJSON.Feature) => {
    if (isReportMode) return;
    const epoch = beginOverlayAction();
    if (!canPresent(epoch)) return;

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
    if (!buildingFeature) {
      Toast.show({
        type: "error",
        text2: "Ramp is not linked to a known building yet, so reviews are unavailable for this point.",
        position: "bottom",
        bottomOffset: bottomTabBarHeight + 50,
      });
      return;
    }

    const buildingAbbr = String(buildingFeature?.properties?.Building_Abbr ?? "").trim();
    const buildingName = String(buildingFeature?.properties?.Description ?? "").trim();
    const externalKey = String(
      properties.ObjectId ??
      properties.OBJECTID ??
      properties.GlobalID ??
      feature.id ??
      `${lng},${lat}`,
    ).trim();

    const controller = registerAbortController();
    void (async () => {
      let rampPoiId: number | null = null;
      try {
        if (controller.signal.aborted || !canPresent(epoch)) return;
        const resolvedPoi = await apiClient.resolveRampPOI({
          externalKey,
          latitude: lat,
          longitude: lng,
          buildingAbbr: buildingAbbr || undefined,
          buildingName: buildingName || undefined,
        });
        if (controller.signal.aborted || !canPresent(epoch)) return;
        rampPoiId = Number(resolvedPoi?.id);
      } catch (error) {
        console.warn("Could not resolve ramp POI id:", error);
        if (controller.signal.aborted || !canPresent(epoch)) return;
      }

      const buildingPoi = buildPoiFromCampusBuilding(
        entrances,
        {
          place_id: `ramp-${externalKey}`,
          geometry: { location: { lat, lng } },
          name: buildingName || "Ramp Access",
          formatted_address: "UT Campus",
        },
        buildingFeature,
      );

      const rampPoi = {
        id: Number.isFinite(rampPoiId) ? (rampPoiId as number) : null,
        poi_type: "ramp",
        location_geojson: {
          type: "Point",
          coordinates: [lng, lat],
        },
        metadata: {
          name: "Ramp Access",
          bld_name: buildingName || "UT Building",
          building_name: buildingName || null,
          building_abbr: buildingAbbr || null,
          external_key: externalKey,
          ramp: true,
        },
      };

      if (controller.signal.aborted || !canPresent(epoch)) return;
      if (!rampPoi.id && buildingPoi) {
        guardedPresent(
          epoch,
          () => {
            locationBottomSheet.current?.dismiss();
            poiBottomSheet.current?.present({ poi: buildingPoi });
          },
          "ramp_to_building_poi",
        );
        return;
      }
      if (!rampPoi.id) return;

      guardedPresent(
        epoch,
        () => {
          locationBottomSheet.current?.dismiss();
          poiBottomSheet.current?.present({ poi: rampPoi });
        },
        "ramp_to_ramp_poi",
      );
    })().finally(() => {
      releaseAbortController(controller);
    });
  }, [
    isReportMode,
    entrances,
    bottomTabBarHeight,
    locationBottomSheet,
    poiBottomSheet,
    beginOverlayAction,
    canPresent,
    guardedPresent,
    registerAbortController,
    releaseAbortController,
  ]);

  /** Handle a tap on a campus building polygon using the local building database. */
  const handleBuildingTap = useCallback((feature: GeoJSON.Feature) => {
    if (isReportMode) return;
    const epoch = beginOverlayAction();
    if (!canPresent(epoch)) return;

    const buildingPoi = buildPoiFromCampusBuilding(entrances, null, feature);
    if (buildingPoi) {
      guardedPresent(
        epoch,
        () => {
          locationBottomSheet.current?.dismiss();
          poiBottomSheet.current?.present({ poi: buildingPoi });
        },
        "building_to_poi",
      );
      return;
    }

    const props = feature.properties as { Building_Abbr?: string } | null;
    const building = props?.Building_Abbr ? findBuilding(props.Building_Abbr) : null;
    if (!building) return;
    guardedPresent(
      epoch,
      () => locationBottomSheet.current?.present(buildingToPlaceDetails(building)),
      "building_to_location",
    );
  }, [isReportMode, entrances, beginOverlayAction, canPresent, guardedPresent, locationBottomSheet, poiBottomSheet]);

  const handleAvoidanceAreaPress = useCallback((polygonId: string) => {
    const area = (avoidanceAreas ?? []).find((a: any) => String(a.id) === polygonId);
    if (!area) return;
    const epoch = beginOverlayAction();
    guardedPresent(
      epoch,
      () => avoidanceAreaBottomSheet.current?.present({ area }),
      "avoidance_area",
    );
  }, [avoidanceAreas, avoidanceAreaBottomSheet, beginOverlayAction, guardedPresent]);

  const handleSidewalkPress = useCallback((segment: SidewalkSegment) => {
    const epoch = beginOverlayAction();
    guardedPresent(
      epoch,
      () => sidewalkBottomSheet.current?.present({ segment }),
      "sidewalk",
    );
  }, [sidewalkBottomSheet, beginOverlayAction, guardedPresent]);

  const handlePOIPress = useCallback((poi: any) => {
    const epoch = beginOverlayAction();
    guardedPresent(epoch, () => poiBottomSheet.current?.present({ poi }), "poi");
  }, [poiBottomSheet, beginOverlayAction, guardedPresent]);

  const handleBarrierPress = useCallback((properties: Record<string, any>) => {
    const epoch = beginOverlayAction();
    guardedPresent(
      epoch,
      () => barrierBottomSheet.current?.present({ barrier: properties }),
      "barrier",
    );
  }, [barrierBottomSheet, beginOverlayAction, guardedPresent]);

  const handleConstructionPress = useCallback((id: string, description?: string) => {
    const epoch = beginOverlayAction();
    guardedPresent(
      epoch,
      () => constructionBottomSheet.current?.present({ construction: { id, description } }),
      "construction",
    );
  }, [constructionBottomSheet, beginOverlayAction, guardedPresent]);

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
