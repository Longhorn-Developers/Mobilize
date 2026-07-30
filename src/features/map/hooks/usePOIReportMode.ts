// Hook to handle poi report functionality

import * as turf from "@turf/turf";
import { useState, useMemo } from "react";
import Toast from "react-native-toast-message";
import { POIReportData } from "../../components/POIBottomSheet";

export function usePOIReportMode(bottomTabBarHeight: number) {
  const [isPOIReportMode, setIsPOIReportMode] = useState(false);
  const [reportData, setReportData] = useState<POIReportData | undefined>(undefined);

  const resetReport = () => {
    setIsPOIReportMode(false);
    setReportData(undefined);
  };

  return {
    state: {
      isPOIReportMode,
      reportData,
    },
    action: {
      setIsPOIReportMode,
      resetReport,
      setReportData,
    },
  };
}