import { router } from "expo-router";
import { CaretLeft } from "phosphor-react-native";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "~/components/Button";
import { APP_ROUTES } from "~/utils/routes";

export default function UTEidComingSoonScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white px-6 dark:bg-neutral-900" style={{ paddingTop: insets.top }}>
      <TouchableOpacity
        onPress={() => router.back()}
        className="mb-4 mt-4"
        style={{ width: 24, height: 24, paddingTop: 4, paddingBottom: 4, paddingLeft: 7, paddingRight: 7 }}
      >
        <CaretLeft size={24} color="#BF5700" />
      </TouchableOpacity>

      <View className="flex-1 items-center justify-center">
        <Text className="mb-3 text-2xl font-bold text-ut-black dark:text-white">
          UT EID Sign-in
        </Text>
        <Text className="mb-8 text-center text-base text-gray-600 dark:text-gray-300">
          This flow is coming soon. For now, use Continue with Google.
        </Text>
        <Button title="Back to Sign In" onPress={() => router.replace(APP_ROUTES.WELCOME as any)} />
      </View>
    </View>
  );
}
