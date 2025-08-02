import { Stack } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AppleMaps, Coordinates } from "expo-maps";
import { AppleMapsPolygon } from "expo-maps/build/apple/AppleMaps.types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/Button";
import ReportModal from "~/components/ReportModal";
import { useQuery } from "@supabase-cache-helpers/postgrest-react-query";
import { supabase } from "~/utils/supabase";

export default function Home() {
  const insets = useSafeAreaInsets();

  const [isReportMode, setIsReportMode] = useState(false);
  const [aaPoints, setAAPoints] = useState<Coordinates[]>([]);
  const [reportStep, setReportStep] = useState(0);

  // const { data: avoidanceAreas } = useQuery(
  //   supabase.from("avoidance_areas_with_geojson").select("id,name,boundary"),
  // );

  const avoidanceAreas = [
    {
      id: "08735f06-10ce-4a71-a693-5c6a367967af",
      name: "Downtown Austin",
      boundary: {
        coordinates: [
          [
            [-97.7333, 30.2672],
            [-97.7338, 30.2672],
            [-97.7338, 30.268],
            [-97.7333, 30.268],
            [-97.7333, 30.2672],
          ],
        ],
        type: "Polygon",
      },
    },
  ];

  const polygons = [
    // Avoidance areas from the database
    ...avoidanceAreas.map<AppleMapsPolygon>((area) => ({
      coordinates: area.boundary.coordinates[0].map((coord) => ({
        latitude: coord[1],
        longitude: coord[0],
      })),
      color: "rgba(255, 0, 0, 0.25)",
      lineColor: "rgba(255, 0, 0, 0.5)",
      lineWidth: 0.1,
    })),
    // User selected aaPoints to report
    {
      coordinates: aaPoints,
      color: "rgba(255, 0, 0, 0.25)",
      lineColor: "red",
      lineWidth: 2,
    },
  ] satisfies AppleMapsPolygon[];

  // Add pressed coordinates to marked points
  const handleMapPress = (event: any) => {
    if (!isReportMode || reportStep !== 0) return;

    setAAPoints((prev) => [...prev, event]);
  };

  return (
    <>
      <Stack.Screen options={{ title: "Home", headerShown: false }} />
      <AppleMaps.View
        style={{ flex: 1 }}
        onMapClick={handleMapPress}
        polygons={polygons}
        markers={aaPoints.map((point) => ({
          coordinates: point,
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
            aaPoints={aaPoints}
            currentStep={reportStep}
            setAAPoints={(points) => setAAPoints(points)}
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
