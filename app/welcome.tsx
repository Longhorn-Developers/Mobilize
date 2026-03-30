import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "~/components/Button";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  const handleUTEIDContinue = () => {
    router.push("./auth/login" as any);
  };

  const handleGoogleContinue = () => {
    // TODO: Implement Google OAuth
    console.log("Google OAuth");
    router.push("./auth/profile-setup" as any);
  };

  return (
    <View 
      className="flex-1 bg-white px-6"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="mb-8 mt-8 items-center">
        {/* Status Bar */}
        <View className="mb-6 w-full flex-row items-center justify-between">
          <Text className="text-base font-medium">9:41</Text>
          <View className="flex-row items-center gap-1">
            <View className="h-1 w-4 bg-black" />
            <View className="h-1 w-4 bg-black" />
            <View className="h-1 w-4 bg-black" />
            <View className="h-1 w-4 bg-gray-300" />
            <Text className="ml-2 text-sm">📶 📶 🔋</Text>
          </View>
        </View>

        {/* Main Image Placeholder */}
        <View className="mb-6 h-40 w-full items-center justify-center rounded-lg bg-gray-200">
          <Text className="text-gray-500">MobilizeUT Logo</Text>
        </View>
        
        <Text className="text-2xl font-bold text-ut-black">
          Welcome to Mobilize UT
        </Text>
        <Text className="mt-2 text-center text-gray-600">
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