import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { CaretLeft } from "phosphor-react-native";

import { Button } from "~/components/Button";

export default function GoogleOAuthScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Simulate OAuth process - replace with real Google OAuth
    const timer = setTimeout(() => {
      setIsLoading(false);
      setIsAuthenticated(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleContinue = () => {
    router.replace("/auth/profile-setup");
  };

  const handleGoBack = () => {
    router.back();
  };

  if (isLoading) {
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
        {/* Google Logo */}
        <View className="mb-8 h-20 w-20 items-center justify-center rounded-full bg-gray-100">
          <Text className="text-3xl font-bold text-gray-700">G</Text>
        </View>

        <Text className="mb-4 text-center text-xl font-semibold text-gray-900">
          Google Account Connected
        </Text>
        
        <Text className="mb-8 text-center text-gray-600">
          Your Google account has been successfully connected to Mobilize UT.
        </Text>

        <View className="w-full gap-3">
          <Button title="Continue to Profile Setup" onPress={handleContinue} />
          <Button title="Go Back" variant="gray" onPress={handleGoBack} />
        </View>
      </View>
    </View>
  );
}
