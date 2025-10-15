import "~/global.css";
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
  return (
    <AuthProvider>
      <GestureHandlerRootView>
        <BottomSheetModalProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }} />
          <Toast config={toastConfig} />
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </AuthProvider>
  );
}
