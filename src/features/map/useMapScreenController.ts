// Main screen controller for the map

import { Camera } from "@rnmapbox/maps";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

import type { POIReviewData } from "~/src/features/components/POIBottomSheet";
import { useMapBottomSheets } from "~/src/features/map/hooks/useMapBottomSheets";
import { useMapOverlay } from "~/src/features/map/hooks/useMapOverlay";
import { useMapPressHandlers } from "~/src/features/map/hooks/useMapPressHandlers";
import { useMapSearch } from "~/src/features/map/hooks/useMapSearch";
import { useReportMode } from "~/src/features/map/hooks/useReportMode";
import { usePOIReportMode } from "~/src/features/map/hooks/usePOIReportMode";
import { getStoredMapDetailMode, type MapDetailMode } from "~/utils/mapPreferences";

export function useMapScreenController({
  isTabFocused,
  bottomTabBarHeight,
  avoidanceAreas,
  entrances,
}: any) {
  const cameraRef = useRef<Camera>(null);

  const bottomSheet = useMapBottomSheets();
  const report = useReportMode(bottomTabBarHeight);
  const poiReport = usePOIReportMode(bottomTabBarHeight);

  const [poi, setPoi] = useState<POIReviewData>();
  const [reviewKey, setReviewKey] = useState(0);

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
    closeAllSheets,
  } = useMapOverlay({
    isTabFocused,
    onDismissSheets: stableDismissSheets,
    onResetUiState: stableResetUiState,
  });

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
    isPOIReportMode: poiReport.state.isPOIReportMode,
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
    poiReport.action.resetReport();
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

  const handleEnterReviewMode = useCallback((reviewData: POIReviewData) => {
    const epoch = beginOverlayAction();
    if (!canPresent(epoch)) return;
    setPoi(reviewData);
    setReviewKey((k) => k + 1);
    guardedPresent(epoch, () => bottomSheet.ref.reviewSheet.current?.present(), "review_open");
  }, [beginOverlayAction, canPresent, guardedPresent, bottomSheet.ref.reviewSheet]);

  const handleExitReviewMode = useCallback(() => {
    bottomSheet.action.closeAllSheets();
    setPoi(undefined);
  }, [bottomSheet.action.closeAllSheets]);

  return {
    cameraRef,
    featureTappedRef,
    bottomSheet,
    report,
    poiReport,
    search,
    poi,
    reviewKey,
    setReviewKey,
    handleEnterReviewMode,
    handleExitReviewMode,
    closeAllSheets,
    mapPress,
    showDetailedLayers: mapDetailMode === "detailed",
  };
}
