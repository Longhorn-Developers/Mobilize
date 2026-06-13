// Hook to handle report functionality

import * as turf from "@turf/turf";
import { useState, useMemo } from "react";
import Toast from "react-native-toast-message";

type LatLng = { latitude: number; longitude: number };

export function useReportMode(bottomTabBarHeight: number) {
  const [isReportMode, setIsReportMode] = useState(false);
  const [aaPointsReport, setAAPointsReport] = useState<LatLng[]>([]);
  const [clickedPoint, setClickedPoint] = useState<LatLng | null>(null);
  const [reportStep, setReportStep] = useState(0);

  const isPointValid = (point: LatLng) => {
    if (aaPointsReport.length < 3) return true;
    const polygon = turf.polygon([[
      ...aaPointsReport.map((p) => [p.longitude, p.latitude]),
      [point.longitude, point.latitude],
      [aaPointsReport[0].longitude, aaPointsReport[0].latitude],
    ]]);
    return turf.kinks(polygon).features.length === 0;
  };

  const handleMapTap = (coordinate: LatLng) => {
    if (!isReportMode || reportStep !== 0) return;
    if (isPointValid(coordinate)) {
      setClickedPoint(coordinate);
      setAAPointsReport((prev) => [...prev, coordinate]);
    } else {
      Toast.show({
        type: "error",
        text2: "Invalid point! Please select a different point.",
        position: "bottom",
        bottomOffset: bottomTabBarHeight + 50,
      });
    }
  };

  const resetReport = () => {
    setIsReportMode(false);
    setAAPointsReport([]);
    setClickedPoint(null);
    setReportStep(0);
  };

  const reportGeoJSON = useMemo((): GeoJSON.FeatureCollection | null => {
      if (aaPointsReport.length < 2) return null;
      const coords = aaPointsReport.map(
        (p) => [p.longitude, p.latitude] as [number, number],
      );
      const geometry: GeoJSON.Geometry =
        aaPointsReport.length >= 3
          ? { type: "Polygon", coordinates: [[...coords, coords[0]]] }
          : { type: "LineString", coordinates: coords };
      return {
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry }],
      };
    }, [aaPointsReport]);

  return {
    state: {
      isReportMode,
      aaPointsReport,
      clickedPoint,
      reportStep,
      reportGeoJSON,
    },
    action: {
      setIsReportMode,
      setAAPointsReport,
      setReportStep,
      handleMapTap,
      resetReport,
    },
  };
}