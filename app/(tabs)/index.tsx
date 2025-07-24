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
import { ReportModal } from "~/components/ReportModal";

export default function Home() {
  const [isReportMode, setIsReportMode] = useState(false);
  const [aaPoints, setAAPoints] = useState<LatLng[]>([]);

  const { data: avoidanceAreas } = useQuery(
    supabase.from("avoidance_areas_with_geojson").select("id,name,boundary"),
  );

  // Add pressed coordinates to marked points
  const handleMapPress = (event: MapPressEvent) => {
    if (
      !isReportMode ||
      !event.nativeEvent.coordinate ||
      aaPoints.includes(event.nativeEvent.coordinate)
    )
      return;

    event.persist();
    setAAPoints((prev) => [...(prev || []), event.nativeEvent.coordinate]);
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
        {/* Show avoidance area polygons */}
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

        {/* Show selected avoidance area coordinate points */}
        {aaPoints.map((point) => (
          <Marker
            key={`${point.latitude}-${point.longitude}`}
            coordinate={{
              latitude: point.latitude,
              longitude: point.longitude,
            }}
            pinColor="red"
          />
        ))}
      </MapView>

      {isReportMode ? (
        <>
          {/* Report mode overlay tint */}
          <View className="pointer-events-none absolute bottom-0 left-0 right-0 top-0 bg-ut-blue/15" />
          {/* Report Mode Dialog */}
          <ReportModal
            className="absolute left-10 right-10 top-20"
            aaPoints={aaPoints}
            onUndoAAPoints={() => setAAPoints((prev) => prev.slice(0, -1))}
            onClearAAPoints={() => setAAPoints([])}
            isVisible={isReportMode}
            onSubmit={() => {
              console.log("Submitting avoidance area points:", aaPoints);
              setAAPoints([]);
              setIsReportMode(false);
            }}
            onExit={() => {
              setAAPoints([]);
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
