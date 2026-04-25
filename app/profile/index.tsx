import { Redirect } from "expo-router";

export default function LegacyProfileIndexRoute() {
  return <Redirect href="/(tabs)/profile" />;
}
