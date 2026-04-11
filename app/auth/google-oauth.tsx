import { CaretLeft } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "~/components/Button";
import { useAuth } from "~/utils/useAuth";

export default function GoogleOAuthScreen() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const { signInWithGoogle } = useAuth();

  useEffect(() => {
    handleGoogleSignIn();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    const result = await signInWithGoogle();

    if (result.success) {
      if (result.isNewUser) {
        router.replace("/auth/profile-setup");
      } else {
        router.replace("/(tabs)");
      }
    } else {
      setIsLoading(false);
      setError(result.error || "Authentication failed");
    }
  };

  if (error) {
    return (
      <View
        className="flex-1 bg-white px-6 dark:bg-neutral-900"
        style={{ paddingTop: insets.top }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="mb-4 mt-4"
          style={{ width: 24, height: 24, paddingTop: 4, paddingBottom: 4, paddingLeft: 7, paddingRight: 7 }}
        >
          <CaretLeft size={24} color="#BF5700" />
        </TouchableOpacity>

        <View className="flex-1 items-center justify-center">
          <Text className="mb-4 text-6xl">⚠️</Text>
          <Text className="mb-4 text-center text-xl font-semibold text-gray-900 dark:text-white">
            Authentication Failed
          </Text>
          <Text className="mb-8 text-center text-gray-600 dark:text-gray-400">{error}</Text>

          <View className="w-full gap-3">
            <Button title="Try Again" onPress={handleGoogleSignIn} />
            <Button title="Go Back" variant="gray" onPress={() => router.back()} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      className="flex-1 bg-white px-6 dark:bg-neutral-900"
      style={{ paddingTop: insets.top }}
    >
      <TouchableOpacity
        onPress={() => router.back()}
        className="mb-4 mt-4"
        style={{ width: 24, height: 24, paddingTop: 4, paddingBottom: 4, paddingLeft: 7, paddingRight: 7 }}
      >
        <CaretLeft size={24} color="#BF5700" />
      </TouchableOpacity>

      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#BF5700" />
        <Text className="mt-4 text-center text-lg text-gray-600 dark:text-gray-400">
          Connecting to Google...
        </Text>
      </View>
    </View>
  );
}
