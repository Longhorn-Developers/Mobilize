import "~/global.css";
import { AppStateStatus, Platform } from "react-native";
import * as Network from "expo-network";
import { Stack } from "expo-router";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import { useAppState } from "~/hooks/useAppState";

function onAppStateChange(status: AppStateStatus) {
  // React Query already supports in web browser refetch on window focus by default
  if (Platform.OS !== "web") {
    focusManager.setFocused(status === "active");
  }
}

// react-query refetch on network reconnect
onlineManager.setEventListener((setOnline) => {
  const eventSubscription = Network.addNetworkStateListener((state) => {
    setOnline(!!state.isConnected);
  });
  return eventSubscription.remove;
});

const queryClient = new QueryClient();

export default function Layout() {
  // react-query refetch on app focus
  useAppState(onAppStateChange);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
