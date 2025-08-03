import { Stack } from "expo-router";
import { useState, useRef } from "react";
import { View } from "react-native";
import { AppleMaps, Coordinates } from "expo-maps";
import { useImage } from "expo-image";
import { AppleMapsPolygon } from "expo-maps/build/apple/AppleMaps.types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/Button";
import ReportModal from "~/components/ReportModal";
import AvoidanceAreaBottomSheet from "~/components/AvoidanceAreaBottomSheet";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQuery } from "@supabase-cache-helpers/postgrest-react-query";
import { supabase } from "~/utils/supabase";

export default function Home() {
  const insets = useSafeAreaInsets();

  const [isReportMode, setIsReportMode] = useState(false);
  const [aaPointsReport, setAAPointsReport] = useState<Coordinates[]>([]);
  const [reportStep, setReportStep] = useState(0);

  const bottomSheetRef = useRef<BottomSheetModal>(null);

  const pointImage = useImage(require("../../assets/point.svg"), {
    maxWidth: 32,
    maxHeight: 32,
    onError(error) {
      console.error(error);
    },
  });

  const { data: avoidanceAreas } = useQuery(
    supabase.from("avoidance_areas_with_geojson").select("id,boundary"),
  );

  const handleMapPress = (event: any) => {
    if (isReportMode) {
      if (reportStep !== 0) return;
      // Add pressed coordinates to marked points
      setAAPointsReport((prev) => [...prev, event]);
    } else {
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
        onMapClick={handleMapPress}
        onPolygonClick={handleAvoidanceAreaPress}
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
        annotations={aaPointsReport.map((point) => ({
          coordinates: point,
          icon: pointImage ? pointImage : undefined,
        }))}
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
