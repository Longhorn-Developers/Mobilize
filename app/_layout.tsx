import "~/global.css";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import * as Network from "expo-network";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CheckIcon, XIcon } from "phosphor-react-native";
import { AppStateStatus, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast, {
  ErrorToast,
  SuccessToast,
  ToastConfig,
} from "react-native-toast-message";
import { useSyncQueriesExternal } from "react-query-external-sync";

import colors from "~/types/colors";
import { ThemeProvider, useTheme } from "~/utils/ThemeContext";
import { useAppState } from "~/utils/useAppState";

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== "web") {
    focusManager.setFocused(status === "active");
  }
}

onlineManager.setEventListener((setOnline) => {
  const eventSubscription = Network.addNetworkStateListener((state) => {
    setOnline(!!state.isConnected);
  });
  return eventSubscription.remove;
});

const queryClient = new QueryClient();

export default function Layout() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function App() {
  const { colorScheme } = useTheme();

  const toastConfig = {
    success: (props: { props: ToastConfig }) => (
      <>
        <View className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-2/3 rounded-lg bg-lime-200 p-2">
          <CheckIcon color={colors.ut.green} />
        </View>
        <SuccessToast
          {...props}
          text2NumberOfLines={3}
          text2Style={{
            fontSize: 13,
            color: colorScheme === "dark" ? "#D1D5DB" : "gray",
            textAlign: "center",
            paddingVertical: 15,
          }}
          style={{
            borderLeftWidth: 0,
            height: "auto",
            backgroundColor: colorScheme === "dark" ? "#1C1C1E" : "#FFFFFF",
          }}
        />
      </>
    ),
    error: (props: { props: ToastConfig }) => (
      <>
        <View className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-2/3 rounded-lg bg-red-200 p-2">
          <XIcon color={colors.theme.red} />
        </View>
        <ErrorToast
          {...props}
          text2NumberOfLines={3}
          text2Style={{
            fontSize: 13,
            color: colorScheme === "dark" ? "#D1D5DB" : "gray",
            textAlign: "center",
            paddingVertical: 15,
          }}
          style={{
            borderLeftWidth: 0,
            height: "auto",
            backgroundColor: colorScheme === "dark" ? "#1C1C1E" : "#FFFFFF",
          }}
        />
      </>
    ),
  };

  useSyncQueriesExternal({
    queryClient,
    socketURL: "http://localhost:42831",
    deviceName: Platform?.OS || "web",
    platform: Platform?.OS || "web",
    deviceId: Platform?.OS || "web",
  });
  useAppState(onAppStateChange);

  return (
    <GestureHandlerRootView>
      <BottomSheetModalProvider>
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
        <Stack screenOptions={{ headerShown: false }} />
      </BottomSheetModalProvider>
      <Toast config={toastConfig} />
    </GestureHandlerRootView>
  );
}
