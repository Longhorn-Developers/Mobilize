import { router } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "~/src/features/components/Button";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  const handleUTEIDContinue = () => {
    router.push("./auth/ut-eid-coming-soon" as any);
  };

  // Step 2 fix: route through the real OAuth flow, not directly to profile-setup
  const handleGoogleContinue = () => {
    router.push("./auth/google-oauth" as any);
  };

  return (
    <View
      className="flex-1 bg-white px-6 dark:bg-neutral-900"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="mb-8 mt-8 items-center">
        {/* Main Image Placeholder */}
        <View className="mb-6 h-40 w-full items-center justify-center rounded-lg bg-gray-200 dark:bg-neutral-800">
          <Text className="text-gray-500 dark:text-gray-400">MobilizeUT Logo</Text>
        </View>

        <Text className="text-2xl font-bold text-ut-black dark:text-white">
          Welcome to Mobilize UT
        </Text>
        <Text className="mt-2 text-center text-gray-600 dark:text-gray-400">
          Mobility companion for everyone
        </Text>
      </View>

      {/* Action Buttons */}
      <View className="flex-1 justify-end pb-8">
        <Button
          title="Continue with UT EID"
          onPress={handleUTEIDContinue}
          className="mb-4"
        />

        <Button
          title="Continue with Google"
          variant="gray"
          onPress={handleGoogleContinue}
        />
      </View>
    </View>
  );
}
