// Bottom Sheets UI controller

import { useCallback, useRef } from "react";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

import {
  LocationDetailsBottomSheetRef,
} from "~/src/features/components/LocationDetailsBottomSheet";

export function useMapBottomSheets() {
  const avoidanceAreaBottomSheet = useRef<BottomSheetModal>(null);
  const poiBottomSheet = useRef<BottomSheetModal>(null);
  const reviewSheet = useRef<BottomSheetModal>(null);
  const locationBottomSheet =
    useRef<LocationDetailsBottomSheetRef>(null);
  const sidewalkBottomSheet = useRef<BottomSheetModal>(null);
  const barrierBottomSheet = useRef<BottomSheetModal>(null);
  const constructionBottomSheet = useRef<BottomSheetModal>(null);

  const closeAllSheets = useCallback(() => {
    avoidanceAreaBottomSheet.current?.dismiss();
    poiBottomSheet.current?.dismiss();
    sidewalkBottomSheet.current?.dismiss();
    locationBottomSheet.current?.dismiss();
    barrierBottomSheet.current?.dismiss();
    constructionBottomSheet.current?.dismiss();
    reviewSheet.current?.dismiss();
  }, []);

  return {
    ref: {
      avoidanceAreaBottomSheet,
      poiBottomSheet,
      reviewSheet,
      locationBottomSheet,
      sidewalkBottomSheet,
      barrierBottomSheet,
      constructionBottomSheet,
    },

    action: {
      closeAllSheets,
    },
  };
}