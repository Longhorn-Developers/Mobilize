import { Stack } from "expo-router";
import { useState } from "react";
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

      {/* Bottom right button to enter report mode */}
      <Button
        className="absolute bottom-4 right-4"
        title={isReportMode ? "Exit Report Mode" : "Report Area"}
        onPress={() => setIsReportMode(!isReportMode)}
      />

      {/* Report Mode Dialog */}
      <ReportModal
        className="absolute left-12 right-12 top-20"
        isVisible={isReportMode}
        aaPoints={aaPoints}
        onCancel={() => {
          setIsReportMode(false);
          setAAPoints([]);
        }}
        onSubmit={() => {
          console.log("Submitting report with points:", aaPoints);
          setIsReportMode(false);
          setAAPoints([]);
        }}
        onClearPoints={() => setAAPoints([])}
      />
    </>
  );
}
