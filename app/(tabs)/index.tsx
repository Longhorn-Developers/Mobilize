import { Stack } from "expo-router";
import { useEffect } from "react";
import MapView, { Polygon } from "react-native-maps";
import { useQuery } from "@supabase-cache-helpers/postgrest-react-query";
import { supabase } from "~/utils/supabase";

export default function Home() {
  const { data: avoidanceAreas } = useQuery(
    supabase.from("avoidance_areas_with_geojson").select("id,name,boundary"),
  );

  useEffect(() => {
    console.log(
      "Fetched avoidance areas:",
      avoidanceAreas?.map((area) => area.name),
    );
  }, [avoidanceAreas]);

  return (
    <>
      <Stack.Screen options={{ title: "Home", headerShown: false }} />
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
      </MapView>
    </>
  );
}
