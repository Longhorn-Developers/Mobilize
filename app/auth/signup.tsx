import { router } from "expo-router";
import {
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "~/src/features/components/Button";

export default function SignupScreen() {
  const insets = useSafeAreaInsets();

  const handleGoogleSignup = () => {
    router.push("./google-oauth" as any);
  };

  const handleUTEIDContinue = () => {
    router.push("./ut-eid-coming-soon" as any);
  };

  return (
    <View 
      className="flex-1 bg-white px-6"
      style={{ paddingTop: insets.top }}
    >
      {/* Header Image Placeholder */}
      <View className="mb-8 mt-8 items-center">
        <View className="mb-6 h-40 w-full rounded-lg bg-gray-200" />
        
        <Text className="text-2xl font-bold text-ut-black">
          Welcome to Mobilize UT
        </Text>
        <Text className="mt-2 text-gray-600">
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
          onPress={handleGoogleSignup}
        />
      </View>
    </View>
  );
}
