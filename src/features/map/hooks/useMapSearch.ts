// Hook to handle map searching

import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Camera } from "@rnmapbox/maps";
import { useCallback, useState } from "react";

import buildingsData from "~/assets/geojson/buildings_simple.json";
import { type LocationDetailsBottomSheetRef } from "~/src/features/components/LocationDetailsBottomSheet";
import { findCampusBuildingFeature, isLikelyCampusCoordinate } from "~/src/features/pois/buildingUtils";
import { buildPoiFromCampusBuilding } from "~/src/features/pois/poiBuildingUtils";
import { buildingToPlaceDetails, findBuilding, searchBuildings } from "~/utils/buildingDatabase";
import { getPlaceDetails, searchPlaces } from "~/utils/googlePlaces";

const looksLikeCampusAbbreviation = (query: string) => {
  const normalized = query.trim().toUpperCase();
  return /^[A-Z0-9]{2,6}$/.test(normalized);
};

type UseMapSearchParams = {
  cameraRef: React.RefObject<Camera | null>;
  entrances: any[];
  locationBottomSheet: React.RefObject<LocationDetailsBottomSheetRef | null>;
  poiBottomSheet: React.RefObject<BottomSheetModal | null>;
  /** From useMapOverlay */
  beginOverlayAction: () => number;
  canPresent: (epoch: number) => boolean;
  guardedPresent: (epoch: number, fn: () => void, name: string) => boolean;
  registerAbortController: () => AbortController;
  releaseAbortController: (c: AbortController) => void;
};

export function useMapSearch({
  cameraRef,
  entrances,
  locationBottomSheet,
  poiBottomSheet,
  beginOverlayAction,
  canPresent,
  guardedPresent,
  registerAbortController,
  releaseAbortController,
}: UseMapSearchParams) {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (text.length > 0) setIsSearchActive(true);
  }, []);

  const handleSelectLocation = useCallback(
    async (location: { id: string; name: string; address?: string; place_id?: string }) => {
      const epoch = beginOverlayAction();
      if (!canPresent(epoch)) return;
      const controller = registerAbortController();

      setIsSearchActive(false);
      setSearchQuery("");

      try {
        let resolvedPlaceId = location.place_id;

        if (!resolvedPlaceId) {
          const primaryQuery = [location.name, location.address].filter(Boolean).join(" ");
          const fallbackQuery = location.name;

          const resolvePlaceIdWithScopeFallback = async (queryText: string) => {
            if (!queryText.trim()) return undefined;
            const likelyCampusIntent =
              searchBuildings(queryText, 1).length > 0 ||
              looksLikeCampusAbbreviation(queryText);

            if (likelyCampusIntent) {
              const campusResults = await searchPlaces(queryText, { scope: "campus" });
              if (controller.signal.aborted || !canPresent(epoch))
                return undefined;
              if (campusResults[0]?.place_id)
                return campusResults[0].place_id;
              const globalResults = await searchPlaces(queryText, { scope: "global" });
              if (controller.signal.aborted || !canPresent(epoch))
                return undefined;
              return globalResults[0]?.place_id;
            }

            const globalResults = await searchPlaces(queryText, { scope: "global" });
            if (controller.signal.aborted || !canPresent(epoch)) return undefined;
            if (globalResults[0]?.place_id) return globalResults[0].place_id;
            const campusResults = await searchPlaces(queryText, { scope: "campus" });
            if (controller.signal.aborted || !canPresent(epoch)) return undefined;
            return campusResults[0]?.place_id;
          };

          resolvedPlaceId = await resolvePlaceIdWithScopeFallback(primaryQuery);
          if (!resolvedPlaceId && fallbackQuery) {
            resolvedPlaceId = await resolvePlaceIdWithScopeFallback(fallbackQuery);
          }
        }

        if (!resolvedPlaceId) {
          console.error("Could not resolve place_id for selected location", location);
          return;
        }

        let placeDetails = null;
        let matchingBuilding: any = null;

        if (resolvedPlaceId.startsWith("local_")) {
          const building = findBuilding(resolvedPlaceId.replace(/^local_/, ""));
          if (building) {
            placeDetails = buildingToPlaceDetails(building);
            matchingBuilding =
              (buildingsData as any).features?.find(
                (feature: any) =>
                  feature?.properties?.Building_Abbr === building.Building_Abbr,
              ) ?? null;
          }
        } else {
          placeDetails = await getPlaceDetails(resolvedPlaceId, location.name);
          if (controller.signal.aborted || !canPresent(epoch)) return;
          if (placeDetails) {
            const { lat, lng } = placeDetails.geometry.location;
            if (isLikelyCampusCoordinate(lat, lng)) {
              matchingBuilding = findCampusBuildingFeature(
                lat,
                lng,
                placeDetails.name,
                placeDetails.formatted_address,
              );
            }
          }
        }

        if (!placeDetails || controller.signal.aborted || !canPresent(epoch)) return;

        cameraRef.current?.setCamera({
          centerCoordinate: [
            placeDetails.geometry.location.lng,
            placeDetails.geometry.location.lat,
          ],
          zoomLevel: 18,
          animationDuration: 800,
        });

        const buildingPoi = buildPoiFromCampusBuilding(entrances, placeDetails, matchingBuilding);
        if (controller.signal.aborted || !canPresent(epoch)) return;

        if (buildingPoi) {
          guardedPresent(
            epoch,
            () => {
              locationBottomSheet.current?.dismiss();
              poiBottomSheet.current?.present({ poi: buildingPoi });
            },
            "search_to_poi",
          );
        } else {
          guardedPresent(
            epoch,
            () => locationBottomSheet.current?.present(placeDetails),
            "search_to_location",
          );
        }
      } finally {
        releaseAbortController(controller);
      }
    },
    [
      beginOverlayAction,
      canPresent,
      guardedPresent,
      registerAbortController,
      releaseAbortController,
      cameraRef,
      entrances,
      locationBottomSheet,
      poiBottomSheet,
    ],
  );

  const clear = useCallback(() => {
    setIsSearchActive(false);
    setSearchQuery("");
  }, []);

  const open = useCallback(() => setIsSearchActive(true), []);

  return {
    state: { isSearchActive, searchQuery },
    action: { handleSearchChange, handleSelectLocation, clear, open },
  };
}
