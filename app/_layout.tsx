/** Root layout — wraps the entire app with QueryClient, AuthProvider, ThemeProvider, GestureHandler, and BottomSheetModalProvider. */
import "react-native-get-random-values"; // Polyfills crypto.getRandomValues — must load before any code that needs it (Mapbox, Places autocomplete session tokens)
import "~/global.css";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import * as Network from "expo-network";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { CheckIcon, XIcon } from "phosphor-react-native";
import { useEffect, useRef } from "react";
import { AppStateStatus, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast, {
  ErrorToast,
  SuccessToast,
  ToastConfig,
} from "react-native-toast-message";
import { useSyncQueriesExternal } from "react-query-external-sync";

import colors from "~/types/colors";
import { getAuthRedirectTarget } from "~/utils/routes";
import { ThemeProvider, useTheme } from "~/utils/ThemeContext";
import { useAppState } from "~/utils/useAppState";
import { AuthProvider, useAuth } from "~/utils/useAuth";

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

function DevQuerySync() {
  useSyncQueriesExternal({
    queryClient,
    socketURL: "http://localhost:42831",
    deviceName: Platform?.OS || "web",
    platform: Platform?.OS || "web",
    deviceId: Platform?.OS || "web",
  });
  return null;
}

export default function Layout() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function App() {
  const { colorScheme } = useTheme();
  const { isAuthenticated, onboardingComplete, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const lastRedirectRef = useRef<{ target: string; timestamp: number } | null>(null);

  useEffect(() => {
    if (isLoading) return;

    const target = getAuthRedirectTarget({
      isAuthenticated,
      onboardingComplete,
      segments,
    });
    if (!target) return;

    const now = Date.now();
    if (
      lastRedirectRef.current &&
      lastRedirectRef.current.target === target &&
      now - lastRedirectRef.current.timestamp < 800
    ) {
      if (__DEV__) {
        console.log("[auth-guard] deduped redirect", {
          segments,
          target,
        });
      }
      return;
    }

    lastRedirectRef.current = { target, timestamp: now };
    if (__DEV__) {
      console.log("[auth-guard] redirect", {
        isAuthenticated,
        onboardingComplete,
        segments,
        target,
      });
    }
    router.replace(target as any);
  }, [isAuthenticated, isLoading, onboardingComplete, router, segments]);

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

  useAppState(onAppStateChange);

  return (
    <GestureHandlerRootView>
      <BottomSheetModalProvider>
        <StatusBar
          style={colorScheme === "dark" ? "light" : "dark"}
          backgroundColor={colorScheme === "dark" ? "#1A2024" : "#FFFFFF"}
        />
        <Stack screenOptions={{ headerShown: false }} />
      </BottomSheetModalProvider>
      <Toast config={toastConfig} />
      {__DEV__ && <DevQuerySync />}
    </GestureHandlerRootView>
  );
}
