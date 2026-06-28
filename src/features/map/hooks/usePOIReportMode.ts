// Hook to handle poi report functionality

import * as turf from "@turf/turf";
import { useState, useMemo } from "react";
import Toast from "react-native-toast-message";


export function usePOIReportMode(bottomTabBarHeight: number) {
  const [isPOIReportMode, setIsPOIReportMode] = useState(false);

  const resetReport = () => {
    setIsPOIReportMode(false);
  };

  return {
    state: {
      isPOIReportMode,
    },
    action: {
      setIsPOIReportMode,
      resetReport,
    },
  };
}