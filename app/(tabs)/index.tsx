import { Stack } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import MapView, {
  Polygon,
  Marker,
  type LatLng,
  type MapPressEvent,
} from "react-native-maps";
import { useQuery } from "@supabase-cache-helpers/postgrest-react-query";
import { supabase } from "~/utils/supabase";
import { Button } from "~/components/Button";
import ReportModal from "~/components/ReportModal";

export default function Home() {
  const [isReportMode, setIsReportMode] = useState(false);
  const [aaPoints, setAAPoints] = useState<LatLng[]>([]);
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

  // Add pressed coordinates to marked points
  const handleMapPress = (event: MapPressEvent) => {
    if (!isReportMode || reportStep === 1) return;

    const { coordinate } = event.nativeEvent;
    setAAPoints((prev) => [...prev, coordinate]);
  };

  return (
    <>
      <Stack.Screen options={{ title: "Home", headerShown: false }} />
      <MapView
        showsMyLocationButton
        style={{ flex: 1 }}
        onPress={handleMapPress}
        initialRegion={{
          // Default coordinates for UT Tower
          // longitude: -97.73921,
          // latitude: 30.28565,

          // Coordinates for testing seed avoidance area
          longitude: -97.7333,
          latitude: 30.2672,

          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {/* Show fetched avoidance area polygons */}
        {avoidanceAreas &&
          avoidanceAreas.map((area) => (
            <Polygon
              key={area.id}
              coordinates={
                area.boundary?.coordinates[0].map(([longitude, latitude]) => ({
                  latitude,
                  longitude,
                })) || []
              }
              strokeColor="rgba(255, 0, 0, 0.5)"
              fillColor="rgba(255, 0, 0, 0.25)"
              strokeWidth={2}
            />
          ))}

        {/* Individual Points */}
        {aaPoints.map((point, index) => (
          <Marker
            draggable
            key={index}
            coordinate={point}
            onDrag={(e) => {
              const newPoints = [...aaPoints];
              newPoints[index] = e.nativeEvent.coordinate;
              setAAPoints(newPoints);
            }}
          >
            <View className="h-3 w-3 rounded-full bg-red-700" />
          </Marker>
        ))}

        {/* aaPoint area polygon */}
        <Polygon
          coordinates={aaPoints}
          fillColor="rgba(255, 0, 0, 0.25)"
          strokeColor="red"
          strokeWidth={2}
        />
      </MapView>

      {isReportMode ? (
        <>
          {/* Report mode overlay tint */}
          <View className="pointer-events-none absolute bottom-0 left-0 right-0 top-0 bg-ut-blue/15" />
          {/* Report Mode Dialog */}
          <ReportModal
            className="absolute left-10 right-10 top-20"
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
