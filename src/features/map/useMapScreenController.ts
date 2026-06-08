// Main screen controller for the map

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera } from "@rnmapbox/maps";
import { useFocusEffect } from "expo-router";
import { getStoredMapDetailMode, type MapDetailMode } from "~/utils/mapPreferences";
import { useMapBottomSheets } from "~/src/features/map/hooks/useMapBottomSheets";
import { useReportMode } from "~/src/features/map/hooks/useReportMode";
import { useMapSearch } from "~/src/features/map/hooks/useMapSearch";
import { useMapPressHandlers } from "~/src/features/map/hooks/useMapPressHandlers";
import type { POIReviewData } from "~/src/features/components/POIBottomSheet";

export function useMapScreenController({
  isTabFocused,
  bottomTabBarHeight,
  avoidanceAreas,
  entrances,
}: any) {
  const cameraRef = useRef<Camera>(null);
  const featureTappedRef = useRef(false);

  const bottomSheet = useMapBottomSheets();
  const report = useReportMode(bottomTabBarHeight);

  const [poi, setPoi] = useState<POIReviewData>();
  const [reviewKey, setReviewKey] = useState(0);

  const handleSetPoi = useCallback((p?: POIReviewData) => {
    setPoi(p);
  }, []);

  const search = useMapSearch({
    cameraRef,
    entrances,
    locationBottomSheet: bottomSheet.ref.locationBottomSheet,
    poiBottomSheet: bottomSheet.ref.poiBottomSheet,
  });

  const mapPress = useMapPressHandlers({
    isReportMode: report.state.isReportMode,
    entrances,
    avoidanceAreas,
    locationBottomSheet: bottomSheet.ref.locationBottomSheet,
    poiBottomSheet: bottomSheet.ref.poiBottomSheet,
    avoidanceAreaBottomSheet: bottomSheet.ref.avoidanceAreaBottomSheet,
    sidewalkBottomSheet: bottomSheet.ref.sidewalkBottomSheet,
    barrierBottomSheet: bottomSheet.ref.barrierBottomSheet,
    constructionBottomSheet: bottomSheet.ref.constructionBottomSheet,
  });

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

  // Keep latest callbacks in refs so the focus effect never needs to re-run
  const closeAllSheetsRef = useRef(bottomSheet.action.closeAllSheets);
  const clearSearchRef = useRef(search.action.clear);
  const resetReportRef = useRef(report.action.resetReport);
  closeAllSheetsRef.current = bottomSheet.action.closeAllSheets;
  clearSearchRef.current = search.action.clear;
  resetReportRef.current = report.action.resetReport;

  useEffect(() => {
    if (!isTabFocused) {
      closeAllSheetsRef.current();
      clearSearchRef.current();
      resetReportRef.current();
      setPoi(undefined);
    }
  }, [isTabFocused]); // stable — no callbacks in deps

  const handleEnterReviewMode = useCallback(() => {
    setReviewKey((k) => k + 1);
    bottomSheet.ref.reviewSheet.current?.present();
  }, [bottomSheet.ref.reviewSheet]);

  const handleExitReviewMode = useCallback(() => {
    closeAllSheetsRef.current();
    setPoi(undefined);
  }, []);

  const enterReviewMode = useCallback(() => {
    setReviewKey(k => k + 1);
    bottomSheet.ref.reviewSheet.current?.present();
  }, []);

  return {
    cameraRef,
    featureTappedRef,
    bottomSheet,
    report,
    search,
    poi,
    setPoi: handleSetPoi,
    reviewKey,
    setReviewKey,
    handleEnterReviewMode: enterReviewMode,
    handleExitReviewMode,
    mapPress,
    showDetailedLayers: mapDetailMode === "detailed",
  };
}