/**
 * Manages search state and the `handleSelectLocation` flow for the map screen.
 *
 * `handleSelectLocation` resolves a search result to a Google Place, animates
 * the camera, and opens the correct bottom sheet (POI or location details).
 * It uses the overlay epoch/guard system so stale requests don't open sheets
 * after the user has already dismissed search.
 */
import { useCallback, useState } from "react";
import type { RefObject } from "react";

import type { LocationDetailsBottomSheetRef } from "~/components/LocationDetailsBottomSheet";
import {
  buildingToPlaceDetails,
  findBuilding,
  searchBuildings,
} from "~/utils/buildingDatabase";
import { getPlaceDetails, searchPlaces } from "~/utils/googlePlaces";

import buildingsData from "../assets/geojson/buildings_simple.json";

const looksLikeCampusAbbreviation = (query: string) => {
  const normalized = query.trim().toUpperCase();
  return /^[A-Z0-9]{2,6}$/.test(normalized);
};

type UseMapSearchOptions = {
  /** Ref to the Mapbox Camera, only `setCamera` is called so we use a structural type. */
  cameraRef: RefObject<{ setCamera: (opts: Record<string, unknown>) => void } | null>;
  locationBottomSheetRef: RefObject<LocationDetailsBottomSheetRef | null>;
  /** Ref to the POI bottom sheet, only `present` and `dismiss` are called. */
  poiBottomSheetRef: RefObject<{ present: (data?: Record<string, unknown>) => void; dismiss: () => void } | null>;
  /** From useMapOverlay */
  beginOverlayAction: () => number;
  canPresent: (epoch: number) => boolean;
  guardedPresent: (epoch: number, fn: () => void, name: string) => boolean;
  registerAbortController: () => AbortController;
  releaseAbortController: (c: AbortController) => void;
  /** From the component, resolves a place + building to a reviewable POI object */
  buildPoiFromCampusBuilding: (placeDetails: any, buildingFeature: any) => any;
  /** From the component, finds a matching building polygon for coordinates/name */
  findCampusBuildingFeature: (
    lat: number,
    lng: number,
    name?: string,
    address?: string,
  ) => any;
  isLikelyCampusCoordinate: (lat: number, lng: number) => boolean;
};

export function useMapSearch({
  cameraRef, locationBottomSheetRef, poiBottomSheetRef,
  beginOverlayAction, canPresent, guardedPresent,
  registerAbortController, releaseAbortController,
  buildPoiFromCampusBuilding, findCampusBuildingFeature,
  isLikelyCampusCoordinate,
}: UseMapSearchOptions) {
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

            if (likelyCampusIntent) 
            {
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

        const buildingPoi = buildPoiFromCampusBuilding(placeDetails, matchingBuilding);
        if (controller.signal.aborted || !canPresent(epoch)) return;

        if (buildingPoi) {
          guardedPresent(
            epoch,
            () => {
              locationBottomSheetRef.current?.dismiss();
              poiBottomSheetRef.current?.present({ poi: buildingPoi });
            },
            "search_to_poi",
          );
        } else {
          guardedPresent(
            epoch,
            () => locationBottomSheetRef.current?.present(placeDetails),
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
      locationBottomSheetRef,
      poiBottomSheetRef,
      buildPoiFromCampusBuilding,
      findCampusBuildingFeature,
      isLikelyCampusCoordinate,
    ],
  );

  return {
    isSearchActive, setIsSearchActive, searchQuery,
    setSearchQuery, handleSearchChange, handleSelectLocation,
  };
}
