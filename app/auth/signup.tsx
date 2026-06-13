/** Entry point for new users — shows Google sign-in option. Requires no auth. */
import { router } from "expo-router";
import {
  Image,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "~/components/Button";
import { APP_ROUTES } from "~/utils/routes";

export default function SignupScreen() {
  const insets = useSafeAreaInsets();

  const handleGoogleSignup = () => {
    router.push(APP_ROUTES.AUTH_GOOGLE_OAUTH as any);
  };

  const handleUTEIDContinue = () => {
    router.push(APP_ROUTES.AUTH_UT_EID_COMING_SOON as any);
  };

  return (
    <View 
      className="flex-1 bg-white px-6"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="mb-8 mt-8 items-center">
        <Image
          source={require("../../assets/image.png")}
          resizeMode="contain"
          className="mb-6 h-40 w-full rounded-lg"
        />
        
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
