import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQuery } from "@supabase-cache-helpers/postgrest-react-query";
import { useImage } from "expo-image";
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

export default function Home() {
  const insets = useSafeAreaInsets();

  const [isReportMode, setIsReportMode] = useState(false);
  const [aaPointsReport, setAAPointsReport] = useState<Coordinates[]>([]);
  const [reportStep, setReportStep] = useState(0);

  const bottomSheetRef = useRef<BottomSheetModal>(null);

  const pointIcon = useImage(require("../../assets/point.svg"), {
    maxWidth: 64,
    maxHeight: 64,
    onError(error) {
      console.error(error);
    },
  });

  const autoDoorIcon = useImage(require("../../assets/autodoor.svg"), {
    maxWidth: 64,
    maxHeight: 64,
    onError(error) {
      console.error(error);
    },
  });

  const { data: avoidanceAreas } = useQuery(
    supabase.from("avoidance_areas_with_geojson").select("id,boundary"),
  );

  const POIs = [
    {
      coordinates: [
        {
          latitude: 30.26523897879868,
          longitude: -97.73236982430406,
        },
      ],
    },
  ];

  // Check if map pressed is among one of the POIs
  const handlePOIPress = (event: any) => {
    const CLICK_TOLERANCE = 0.0001;
    const POIclicked = POIs.find((poi) => {
      const latDiff = Math.abs(poi.coordinates[0].latitude - event.latitude);
      const lonDiff = Math.abs(poi.coordinates[0].longitude - event.longitude);
      return latDiff <= CLICK_TOLERANCE && lonDiff <= CLICK_TOLERANCE;
    });
    if (POIclicked) {
      console.log("POI CLICKED");
    }
  };

  const handleMapPress = (event: any) => {
    if (isReportMode) {
      if (reportStep !== 0) return;
      // Add pressed coordinates to marked points
      setAAPointsReport((prev) => [...prev, event]);
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

  return (
    <>
      <Stack.Screen options={{ title: "Home", headerShown: false }} />

      {/* Avoidance Area Bottom Sheet */}
      <AvoidanceAreaBottomSheet ref={bottomSheetRef} />

      <AppleMaps.View
        style={{ flex: 1 }}
        onPolygonClick={handleAvoidanceAreaPress}
        onMapClick={handleMapPress}
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
            coordinates:
              area.boundary?.coordinates[0].map((coord) => ({
                latitude: coord[1],
                longitude: coord[0],
              })) || [],
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
            icon: pointIcon ? pointIcon : undefined,
          })),
          // Points of Interest (POIs)
          ...POIs.flatMap((poi) =>
            poi.coordinates.map((coord) => ({
              coordinates: coord,
              icon: autoDoorIcon ? autoDoorIcon : undefined,
            })),
          ),
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
            onSubmit={(data) => {
              console.log("Submitting report:", data);
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
