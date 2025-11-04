import "../polyfills";
import "~/global.css";
import React from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import Toast, {
  ErrorToast,
  SuccessToast,
  ToastConfig,
} from "react-native-toast-message";
import { Stack } from "expo-router";
import { CheckIcon, XIcon } from "phosphor-react-native";
import colors from "~/types/colors";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "~/utils/AuthProvider";
import { MapSettingsProvider } from "~/contexts/MapSettingsContext";
import ErrorBoundary from "~/components/ErrorBoundary";

// Catch unhandled promise rejections
if (typeof (global as any).__OLD_RN_REJECTION_HANDLER__ === 'undefined') {
  const oldHandler = (global as any).onunhandledrejection;
  (global as any).onunhandledrejection = (event: any) => {
    console.error('=== UNHANDLED PROMISE REJECTION ===');
    console.error('Reason:', event?.reason ?? event);
    console.error('Promise:', event?.promise);
    if (oldHandler) oldHandler(event);
  };
  (global as any).__OLD_RN_REJECTION_HANDLER__ = oldHandler;
}

// Catch global errors
const oldErrorHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.error('=== GLOBAL ERROR ===');
  console.error('Fatal:', isFatal);
  console.error('Error:', error);
  console.error('Stack:', error.stack);
  if (oldErrorHandler) oldErrorHandler(error, isFatal);
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

export default function Layout() {
  console.log('=== ROOT LAYOUT RENDERED ===');
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MapSettingsProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <BottomSheetModalProvider>
              <StatusBar style="auto" />
              <Stack screenOptions={{ headerShown: false }} />
              <Toast config={toastConfig} />
            </BottomSheetModalProvider>
          </GestureHandlerRootView>
        </MapSettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
