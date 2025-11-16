import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "~/components/Button";
import colors from "~/types/colors";

export default function LoginScreen() {
  const [utEid, setUtEid] = useState("");
  const [password, setPassword] = useState("");
  const insets = useSafeAreaInsets();

  const handleLogin = () => {
    if (!utEid || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    // TODO: Implement actual login logic
    console.log("Login with:", { utEid, password });
    router.push("../" as any);
  };

  const handleForgotPassword = () => {
    // TODO: Implement forgot password functionality
    Alert.alert("Forgot Password", "Forgot password functionality coming soon!");
  };

  return (
    <View 
      className="flex-1 bg-white px-6"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="mb-8 mt-8">
        <Text className="text-2xl font-bold text-ut-black">
          Sign up with your UT EID
        </Text>
      </View>

      {/* Form */}
      <View className="flex-1">
        {/* UT EID Input */}
        <View className="mb-4">
          <Text className="mb-2 text-sm text-gray-600">UT EID</Text>
          <TextInput
            value={utEid}
            onChangeText={setUtEid}
            placeholder="Enter your UT EID"
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Password Input */}
        <View className="mb-6">
          <Text className="mb-2 text-sm text-gray-600">Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
            className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Sign Up Button */}
        <Button
          title="Sign Up"
          onPress={handleLogin}
          className="mb-4"
        />

        {/* Forgot Password Link */}
        <TouchableOpacity onPress={handleForgotPassword} className="items-center">
          <Text className="text-ut-burntorange">Forgot my UT EID or password</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}