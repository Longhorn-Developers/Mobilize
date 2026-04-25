import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
      <Stack.Screen name="google-oauth" />
      <Stack.Screen name="callback" />
      <Stack.Screen name="ut-eid-coming-soon" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="mobility-preferences" />
    </Stack>
  );
}
