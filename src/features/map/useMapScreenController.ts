// Main screen controller for the map

import { Camera } from "@rnmapbox/maps";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Polygon } from "geojson";

import type { POIReviewData } from "~/src/features/components/POIBottomSheet";
import { useMapBottomSheets } from "~/src/features/map/hooks/useMapBottomSheets";
import { OVERLAY_CLOSE_ANIMATION_MS } from "~/src/features/map/hooks/useMapOverlay";
import { useMapOverlay } from "~/src/features/map/hooks/useMapOverlay";
import { useMapPressHandlers } from "~/src/features/map/hooks/useMapPressHandlers";
import { useMapSearch } from "~/src/features/map/hooks/useMapSearch";
import { useReportMode } from "~/src/features/map/hooks/useReportMode";
import { useNavigationMode } from "~/src/features/navigation/useNavigationMode";
import { useRoutePreview } from "~/src/features/navigation/useRoutePreview";
import { getStoredMapDetailMode, type MapDetailMode } from "~/utils/mapPreferences";

export function useMapScreenController({
  isTabFocused,
  bottomTabBarHeight,
  avoidanceAreas,
  constructionAreas,
  entrances,
}: any) {
  const cameraRef = useRef<Camera>(null);

  // Build avoidance polygon list from both avoidance areas and construction zones
  const avoidPolygons = useMemo<Polygon[]>(() => {
    const aa: Polygon[] = (avoidanceAreas ?? [])
      .map((a: any) => a.boundary_geojson as Polygon)
      .filter(Boolean);
    const ca: Polygon[] = (constructionAreas ?? []).flatMap((area: any) => {
      const coords: [number, number][] = (area.points ?? []).map(
        (c: [number, number]) => [c[1], c[0]] as [number, number],
      );
      if (coords.length < 3) return [];
      const ring =
        coords[0][0] === coords[coords.length - 1][0] &&
        coords[0][1] === coords[coords.length - 1][1]
          ? coords
          : [...coords, coords[0]];
      return [{ type: "Polygon" as const, coordinates: [ring] } satisfies Polygon];
    });
    return [...aa, ...ca];
  }, [avoidanceAreas, constructionAreas]);

  const bottomSheet = useMapBottomSheets();
  const report = useReportMode(bottomTabBarHeight);
  const navigation = useNavigationMode(avoidPolygons);
  const routePreview = useRoutePreview(avoidPolygons);

  const [poi, setPoi] = useState<POIReviewData>();
  const [reviewKey, setReviewKey] = useState(0);

  // Tracks whether the review form is actively being written (ReviewModal's
  // formState === 1), so a stray map tap can't clear `poi`/dismiss the sheet
  // out from under an in-progress review.
  const isReviewActiveRef = useRef(false);
  const setReviewActive = useCallback((active: boolean) => {
    isReviewActiveRef.current = active;
  }, []);

  // Stable refs so useMapOverlay's callbacks can be defined before
  // search/report state setters exist, avoiding a circular dependency.
  const onDismissSheetsRef = useRef<() => void>(() => {});
  const onResetUiStateRef = useRef<() => void>(() => {});
  const stableDismissSheets = useCallback(() => onDismissSheetsRef.current(), []);
  const stableResetUiState = useCallback(() => onResetUiStateRef.current(), []);

  const {
    featureTappedRef,
    beginOverlayAction,
    canPresent,
    guardedPresent,
    registerAbortController,
    releaseAbortController,
    closeAllSheets: closeAllSheetsInternal,
  } = useMapOverlay({
    isTabFocused,
    onDismissSheets: stableDismissSheets,
    onResetUiState: stableResetUiState,
  });

  // Guarded wrapper: a background map tap (the only external caller of this
  // closeAllSheets) must not clear the POI / dismiss the review sheet while
  // the user is actively writing a review.
  const closeAllSheets = useCallback(() => {
    if (isReviewActiveRef.current) return;
    closeAllSheetsInternal();
  }, [closeAllSheetsInternal]);

  const search = useMapSearch({
    cameraRef,
    entrances,
    locationBottomSheet: bottomSheet.ref.locationBottomSheet,
    poiBottomSheet: bottomSheet.ref.poiBottomSheet,
    beginOverlayAction,
    canPresent,
    guardedPresent,
    registerAbortController,
    releaseAbortController,
  });

  const mapPress = useMapPressHandlers({
    isReportMode: report.state.isReportMode,
    entrances,
    avoidanceAreas,
    bottomTabBarHeight,
    locationBottomSheet: bottomSheet.ref.locationBottomSheet,
    poiBottomSheet: bottomSheet.ref.poiBottomSheet,
    avoidanceAreaBottomSheet: bottomSheet.ref.avoidanceAreaBottomSheet,
    sidewalkBottomSheet: bottomSheet.ref.sidewalkBottomSheet,
    barrierBottomSheet: bottomSheet.ref.barrierBottomSheet,
    constructionBottomSheet: bottomSheet.ref.constructionBottomSheet,
    beginOverlayAction,
    canPresent,
    guardedPresent,
    registerAbortController,
    releaseAbortController,
  });

  // Keep the overlay's stable callbacks pointing at the latest implementations.
  onDismissSheetsRef.current = bottomSheet.action.closeAllSheets;
  onResetUiStateRef.current = () => {
    search.action.clear();
    report.action.resetReport();
    setPoi(undefined);
  };

  const [mapDetailMode, setMapDetailMode] = useState<MapDetailMode>("detailed");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getStoredMapDetailMode().then((mode) => {
        if (active) setMapDetailMode(mode);
      });
      return () => { active = false; };
    }, []),
  );

  const handleRequestPreview = useCallback(
    (coords: [number, number], name: string, entrance?: string) => {
      // Dismiss only the POI sheet directly to avoid advancing the overlay epoch
      bottomSheet.ref.poiBottomSheet.current?.dismiss();
      routePreview.action.openPreview(coords, name, entrance ?? "");
      // Wait for dismiss animation before presenting the preview sheet
      setTimeout(() => {
        bottomSheet.ref.routePreviewSheet.current?.present();
      }, OVERLAY_CLOSE_ANIMATION_MS + 30);
    },
    [bottomSheet.ref, routePreview.action],
  );

  const handleEnterReviewMode = useCallback((reviewData: POIReviewData) => {
    const epoch = beginOverlayAction();
    if (!canPresent(epoch)) return;
    setPoi(reviewData);
    setReviewKey((k) => k + 1);
    guardedPresent(epoch, () => bottomSheet.ref.reviewSheet.current?.present(), "review_open");
  }, [beginOverlayAction, canPresent, guardedPresent, bottomSheet.ref.reviewSheet]);

  const handleExitReviewMode = useCallback(() => {
    isReviewActiveRef.current = false;
    bottomSheet.action.closeAllSheets();
    setPoi(undefined);
  }, [bottomSheet.action.closeAllSheets]);

  return {
    cameraRef,
    featureTappedRef,
    bottomSheet,
    report,
    navigation,
    routePreview,
    search,
    poi,
    reviewKey,
    setReviewKey,
    setReviewActive,
    handleEnterReviewMode,
    handleExitReviewMode,
    handleRequestPreview,
    closeAllSheets,
    mapPress,
    showDetailedLayers: mapDetailMode === "detailed",
  };
}
