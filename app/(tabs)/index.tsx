import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQuery } from "@supabase-cache-helpers/postgrest-react-query";
import { AppleMaps, Coordinates } from "expo-maps";
import { AppleMapsPolygon } from "expo-maps/build/apple/AppleMaps.types";
import { Stack } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AvoidanceAreaBottomSheet from "~/components/AvoidanceAreaBottomSheet";
import { Button } from "~/components/Button";
import ReportModal from "~/components/ReportModal";
import { supabase } from "~/utils/supabase";
import * as turf from "@turf/turf";
import Toast from "react-native-toast-message";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { insertAvoidanceArea } from "~/utils/queries";
import { Enums, metadata_types } from "~/types/database";
import useMapIcons from "~/hooks/useMapIcons";

export default function Home() {
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const mapIcons = useMapIcons();

  const [isReportMode, setIsReportMode] = useState(false);
  const [aaPointsReport, setAAPointsReport] = useState<Coordinates[]>([]);
  const [reportStep, setReportStep] = useState(0);

  const bottomSheetRef = useRef<BottomSheetModal>(null);

  const { data: avoidanceAreas } = useQuery(
    supabase.from("avoidance_areas_with_geojson").select("id,boundary"),
  );

  const { data: POIs } = useQuery(
    supabase.from("pois").select("id, poi_type, metadata, location_geojson"),
  );

  // Check if map pressed is among one of the POIs
  const handlePOIPress = (event: Coordinates) => {
    if (!POIs) return;

    const CLICK_TOLERANCE = 0.0001;
    const POIclicked = POIs.find((poi) => {
      const lonDiff = Math.abs(
        poi.location_geojson.coordinates[0] - (event.longitude ?? 0),
      );
      const latDiff = Math.abs(
        poi.location_geojson.coordinates[1] - (event.latitude ?? 0),
      );
      return lonDiff <= CLICK_TOLERANCE && latDiff <= CLICK_TOLERANCE;
    });
    if (POIclicked) {
      console.log(`POI CLICKED: ${POIclicked.id}`);
    }
  };

  // Checks if resulting polygon formed by aaPointsReport + points is valid (no kinks)
  const isPointValid = (point: Coordinates) => {
    if (aaPointsReport.length < 3) return true; // Need at least 3 points to form a polygon

    const polygon = turf.polygon([
      [
        ...aaPointsReport.map((p) => [p.longitude || 0, p.latitude || 0]),
        [point.longitude || 0, point.latitude || 0],
        [aaPointsReport[0].longitude || 0, aaPointsReport[0].latitude || 0],
      ],
    ]);
    const kinks = turf.kinks(polygon);

    // No kinks means the polygon is valid
    return kinks.features.length === 0;
  };

  const handleMapPress = (event: Coordinates) => {
    if (isReportMode) {
      if (reportStep !== 0) return;

      if (isPointValid(event)) {
        // Add pressed coordinates to marked points
        setAAPointsReport((prev) => [...prev, event]);
      } else {
        Toast.show({
          type: "error",
          text2: "Invalid point! Please select a different point.",
          position: "bottom",
          bottomOffset: bottomTabBarHeight + 50,
        });
      }
    } else {
      handlePOIPress(event);
      bottomSheetRef.current?.close();
    }
  };

  // Handle avoidance area click
  const handleAvoidanceAreaPress = (event: AppleMapsPolygon) => {
    if (isReportMode) return;
    bottomSheetRef.current?.present(event);
  };

  const getMapIcon = (poiType: Enums<"poi_type">, metadata: metadata_types) => {
    switch (poiType) {
      case "accessible_entrance":
        return metadata.auto_opene ? mapIcons.autoDoor : mapIcons.manualDoor;
      default:
        return undefined;
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: "Home", headerShown: false }} />

      {/* Avoidance Area Bottom Sheet */}
      <AvoidanceAreaBottomSheet ref={bottomSheetRef} />

      <AppleMaps.View
        style={{ flex: 1 }}
        onPolygonClick={handleAvoidanceAreaPress}
        onMapClick={(event) => handleMapPress(event as Coordinates)}
        cameraPosition={{
          coordinates: {
            // Default coordinates for UT Tower
            // longitude: -97.73921,
            // latitude: 30.28565,

            // Testing camera position for test avoidance area
            longitude: -97.7333,
            latitude: 30.2672,
          },
          zoom: 16,
        }}
        polygons={[
          // Avoidance areas from the database
          ...(avoidanceAreas || []).map<AppleMapsPolygon>((area) => ({
            id: area.id || undefined,
            coordinates: area.boundary.coordinates[0].map((coord) => ({
              longitude: coord[0],
              latitude: coord[1],
            })),
            color: "rgba(255, 0, 0, 0.25)",
            lineColor: "rgba(255, 0, 0, 0.5)",
            lineWidth: 0.1,
          })),
          // User selected aaPoints to report
          {
            coordinates: aaPointsReport,
            color: "rgba(255, 0, 0, 0.25)",
            lineColor: "red",
            lineWidth: 2,
          },
        ]}
        annotations={[
          // User selected aaPoints to report
          ...aaPointsReport.map((point) => ({
            coordinates: point,
            icon: mapIcons.point || undefined,
          })),
          // Points of Interest (POIs)
          ...(POIs || []).map((poi) => ({
            coordinates: {
              longitude: poi.location_geojson.coordinates[0],
              latitude: poi.location_geojson.coordinates[1],
            } satisfies Coordinates,
            icon: getMapIcon(poi.poi_type, poi.metadata) || undefined,
          })),
        ]}
      />

      {isReportMode ? (
        <>
          {/* Report mode overlay tint */}
          <View className="pointer-events-none absolute bottom-0 left-0 right-0 top-0 bg-ut-blue/15" />
          {/* Report Mode Dialog */}
          <ReportModal
            className={`absolute left-10 right-10`}
            style={{
              top: insets.top + 25,
            }}
            aaPoints={aaPointsReport}
            currentStep={reportStep}
            setAAPoints={(points) => setAAPointsReport(points)}
            setCurrentStep={(index) => setReportStep(index)}
            onSubmit={async (data) => {
              const aaPoints = [...data.aaPoints, data.aaPoints[0]];
              await insertAvoidanceArea(data.description, aaPoints);
            }}
            onExit={() => {
              setIsReportMode(false);
            }}
          />
        </>
      ) : (
        // Bottom right button to enter report mode
        <Button
          className="absolute bottom-4 right-4"
          title={"Report"}
          onPress={() => setIsReportMode(true)}
        />
      )}
    </>
  );
}
