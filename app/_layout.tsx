import "~/global.css";
import { AppStateStatus, Platform, View } from "react-native";
import Toast, {
  ErrorToast,
  SuccessToast,
  ToastConfig,
} from "react-native-toast-message";
import * as Network from "expo-network";
import { Stack } from "expo-router";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import { useAppState } from "~/hooks/useAppState";
import { CheckIcon, XIcon } from "phosphor-react-native";
import colors from "~/types/colors";

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

const toastConfig = {
  /*
    Overwrite 'error' type,
    by modifying the existing `ErrorToast` component
  */
  success: (props: { props: ToastConfig }) => (
    <>
      {/* Icon Container */}
      <View className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-2/3 rounded-lg bg-lime-200 p-2">
        <CheckIcon color={colors.ut.green} />
      </View>

      <SuccessToast
        {...props}
        text2NumberOfLines={3}
        text2Style={{
          fontSize: 13,
          color: "gray",
          textAlign: "center",
          paddingVertical: 15,
        }}
        style={{
          borderLeftWidth: 0,
          height: "auto",
        }}
      />
    </>
  ),

  /*
    Overwrite 'error' type,
    by modifying the existing `ErrorToast` component
  */
  error: (props: { props: ToastConfig }) => (
    <>
      {/* Icon Container */}
      <View className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-2/3 rounded-lg bg-red-200 p-2">
        <XIcon color={colors.theme.red} />
      </View>

      <ErrorToast
        {...props}
        text2NumberOfLines={3}
        text2Style={{
          fontSize: 13,
          color: "gray",
          textAlign: "center",
          paddingVertical: 15,
        }}
        style={{
          borderLeftWidth: 0,
          height: "auto",
        }}
      />
    </>
  ),
};

const queryClient = new QueryClient();

export default function Layout() {
  // react-query refetch on app focus
  useAppState(onAppStateChange);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
      <Toast config={toastConfig} />
    </QueryClientProvider>
  );
}
