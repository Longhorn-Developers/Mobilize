import { Stack } from "expo-router";
import { useEffect } from "react";
import { Text } from "react-native";

import { Container } from "~/components/Container";
import { ScreenContent } from "~/components/ScreenContent";
import { useAvoidanceStore } from "~/store/avoidanceStore";

export default function Home() {
  const { avoidanceAreas, avoidanceAreasLoading, fetchAvoidanceAreas } =
    useAvoidanceStore();

  useEffect(() => {
    fetchAvoidanceAreas();
  }, [fetchAvoidanceAreas]);

  return (
    <>
      <Stack.Screen options={{ title: "Home" }} />
      <Container>
        <ScreenContent title="Home">
          <Text>
            {avoidanceAreasLoading
              ? "Fetching avoidance areas..."
              : `Fetched ${avoidanceAreas.length} avoidance areas.`}
          </Text>

          <Text>
            {avoidanceAreas.map((area) => (
                <Text key={area.id}>
                {area.name}:
                {area.boundary
                  ? JSON.stringify(area.boundary)
                  : "No coordinates"}
                </Text>
            ))}
          </Text>
        </ScreenContent>
      </Container>
    </>
  );
}
