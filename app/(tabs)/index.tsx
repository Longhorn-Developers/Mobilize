import { Stack } from "expo-router";
import { useEffect } from "react";
import MapView, { Polygon } from "react-native-maps";

import { useAvoidanceStore } from "~/store/avoidanceStore";

export default function Home() {
  const { avoidanceAreas, fetchAvoidanceAreas } = useAvoidanceStore();

  useEffect(() => {
    fetchAvoidanceAreas();
  }, [fetchAvoidanceAreas]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MapView
        style={{ flex: 1 }}
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
        {avoidanceAreas.map((area) => (
          <Polygon
            key={area.id}
            coordinates={
              area.boundary?.coordinates[0].map(([longitude, latitude]) => ({
                latitude,
                longitude,
              })) || []
            }
            strokeColor="rgba(255, 0, 0, 0.5)"
            fillColor="rgba(255, 0, 0, 0.2)"
            strokeWidth={2}
          />
        ))}
      </MapView>
    </>
  );
}
