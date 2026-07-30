/** Stack navigator for public profile views (/profile/[username]). */
import { Stack } from "expo-router";

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[username]" />
    </Stack>
  );
}