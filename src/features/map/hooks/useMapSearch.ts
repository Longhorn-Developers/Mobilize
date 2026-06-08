// Hook to handle map searching

import { useState } from "react";
import { Camera } from "@rnmapbox/maps";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

import { searchPlaces, getPlaceDetails } from "~/utils/mapboxSearch";
import { buildingToPlaceDetails, findBuilding } from "~/utils/buildingDatabase";
import { findCampusBuildingFeature } from "~/src/features/pois/buildingUtils";
import { buildPoiFromCampusBuilding } from "~/src/features/pois/poiBuildingUtils";
import { type LocationDetailsBottomSheetRef } from "~/src/features/components/LocationDetailsBottomSheet";

import buildingsData from "~/assets/geojson/buildings_simple.json";

type UseMapSearchParams = {
    cameraRef: React.RefObject<Camera | null>;
    entrances: any[];
    locationBottomSheet: React.RefObject<LocationDetailsBottomSheetRef | null>;
    poiBottomSheet: React.RefObject<BottomSheetModal | null>;
};

export function useMapSearch({
  cameraRef,
  entrances,
  locationBottomSheet,
  poiBottomSheet,
}: UseMapSearchParams) {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (!isSearchActive && text.length > 0) setIsSearchActive(true);
  };

  const handleSelectLocation = async (location: {
    id: string;
    name: string;
    address?: string;
    place_id?: string;
  }) => {
    setIsSearchActive(false);
    setSearchQuery("");

    let resolvedPlaceId = location.place_id;
    if (!resolvedPlaceId) {
      const primaryQuery = [location.name, location.address].filter(Boolean).join(" ");
      const primaryResults = await searchPlaces(primaryQuery);
      resolvedPlaceId = primaryResults[0]?.place_id;

      if (!resolvedPlaceId) {
        const fallbackResults = await searchPlaces(location.name);
        resolvedPlaceId = fallbackResults[0]?.place_id;
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
      placeDetails = await getPlaceDetails(resolvedPlaceId);
      if (placeDetails) {
        matchingBuilding = findCampusBuildingFeature(
          placeDetails.geometry.location.lat,
          placeDetails.geometry.location.lng,
          placeDetails.name,
          placeDetails.formatted_address,
        );
      }
    }

    if (!placeDetails) return;

    cameraRef.current?.setCamera({
      centerCoordinate: [
        placeDetails.geometry.location.lng,
        placeDetails.geometry.location.lat,
      ],
      zoomLevel: 18,
      animationDuration: 800,
    });

    const buildingPoi = buildPoiFromCampusBuilding(entrances, placeDetails, matchingBuilding);
    if (buildingPoi) {
      locationBottomSheet.current?.dismiss();
      poiBottomSheet.current?.present({ poi: buildingPoi });
    } else {
      locationBottomSheet.current?.present(placeDetails);
    }
  };

  const clear = () => {
    setIsSearchActive(false);
    setSearchQuery("");
  };

  const open = () => setIsSearchActive(true);

  return {
    state: { isSearchActive, searchQuery },
    action: { handleSearchChange, handleSelectLocation, clear, open },
  };
}