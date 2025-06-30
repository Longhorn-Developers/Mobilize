import "~/global.css";
import { AppStateStatus, Platform } from "react-native";
import { Stack } from "expo-router";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import { useAppState } from "~/hooks/useAppState";
import { useOnlineManager } from "~/hooks/useOnlineManager";

function onAppStateChange(status: AppStateStatus) {
  // React Query already supports in web browser refetch on window focus by default
  if (Platform.OS !== "web") {
    focusManager.setFocused(status === "active");
  }
}

export default function Layout() {
  // react-query refetch on network reconnect
  useOnlineManager();

  // react-query refetch on app focus
  useAppState(onAppStateChange);

  return (
    <QueryClientProvider client={new QueryClient()}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
