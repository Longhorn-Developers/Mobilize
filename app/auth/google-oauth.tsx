import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { CaretLeft } from "phosphor-react-native";
import { useAuth } from "~/utils/useAuth";
import { Button } from "~/components/Button";

export default function GoogleOAuthScreen() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const { signInWithGoogle } = useAuth();

  useEffect(() => {
    // Start the OAuth flow immediately when screen mounts
    handleGoogleSignIn();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    const result = await signInWithGoogle();

    if (result.success) {
      if (result.isNewUser) {
        // New user - go to profile setup
        router.replace("/auth/profile-setup");
      } else {
        // Existing user - go to main app
        router.replace("/(tabs)");
      }
    } else {
      setIsLoading(false);
      setError(result.error || "Authentication failed");
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  const handleRetry = () => {
    handleGoogleSignIn();
  };

  // Error state
  if (error) {
    return (
      <View
        className="flex-1 bg-white px-6"
        style={{ paddingTop: insets.top }}
      >
        {/* Back Button */}
        <TouchableOpacity
          onPress={handleGoBack}
          className="mt-4 mb-4"
          style={{ width: 24, height: 24, paddingTop: 4, paddingBottom: 4, paddingLeft: 7, paddingRight: 7 }}
        >
          <CaretLeft size={24} color="#000" />
        </TouchableOpacity>

        <View className="flex-1 items-center justify-center">
          <Text className="text-6xl mb-4">⚠️</Text>
          <Text className="mb-4 text-center text-xl font-semibold text-gray-900">
            Authentication Failed
          </Text>
          <Text className="mb-8 text-center text-gray-600">{error}</Text>

          <View className="w-full gap-3">
            <Button title="Try Again" onPress={handleRetry} />
            <Button title="Go Back" variant="gray" onPress={handleGoBack} />
          </View>
        </View>
      </View>
    );
  }

  // Loading state
  return (
    <View 
      className="flex-1 bg-white px-6"
      style={{ paddingTop: insets.top }}
    >
      {/* Back Button */}
      <TouchableOpacity
        onPress={handleGoBack}
        className="mt-4 mb-4"
        style={{ width: 24, height: 24, paddingTop: 4, paddingBottom: 4, paddingLeft: 7, paddingRight: 7 }}
      >
        <CaretLeft size={24} color="#000" />
      </TouchableOpacity>

      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#BF5700" />
        <Text className="mt-4 text-center text-lg text-gray-600">
          Connecting to Google...
        </Text>
      </View>
    </View>
  );
}
