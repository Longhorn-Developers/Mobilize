import { router } from "expo-router";
import { CaretLeft } from "phosphor-react-native";
import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "~/components/Button";

export default function LoginScreen() {
  const [utEid, setUtEid] = useState("");
  const [password, setPassword] = useState("");
  const insets = useSafeAreaInsets();

  const handleLogin = () => {
    if (!utEid || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    Alert.alert("Coming Soon", "UT EID sign-in is not available yet. Please use Continue with Google.");
  };

  const handleForgotPassword = () => {
    Alert.alert("Forgot Password", "Visit utexas.edu/its to reset your UT EID password.");
  };

  return (
    <View
      className="flex-1 bg-white px-6 dark:bg-neutral-900"
      style={{ paddingTop: insets.top }}
    >
      {/* Back Button */}
      <TouchableOpacity
        onPress={() => router.back()}
        className="mb-4 mt-4"
        style={{ width: 24, height: 24, paddingTop: 4, paddingBottom: 4, paddingLeft: 7, paddingRight: 7 }}
      >
        <CaretLeft size={24} color="#BF5700" />
      </TouchableOpacity>

      {/* Header */}
      <View className="mb-8">
        <Text className="text-2xl font-bold text-ut-black dark:text-white">
          Sign in with your UT EID
        </Text>
      </View>

      {/* Form */}
      <View className="flex-1">
        <View className="mb-4">
          <Text className="mb-2 text-sm text-gray-600 dark:text-gray-400">UT EID</Text>
          <TextInput
            value={utEid}
            onChangeText={setUtEid}
            placeholder="Enter your UT EID"
            placeholderTextColor="#9CA3AF"
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View className="mb-6">
          <Text className="mb-2 text-sm text-gray-600 dark:text-gray-400">Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Button title="Sign In" onPress={handleLogin} className="mb-4" />

        <TouchableOpacity onPress={handleForgotPassword} className="items-center">
          <Text className="text-ut-burntorange">Forgot my UT EID or password</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
