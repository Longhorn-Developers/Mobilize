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

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const insets = useSafeAreaInsets();

  const handleSignup = () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    // TODO: Implement actual signup logic
    console.log("Signup with:", { email, password });
    router.push("./profile-setup" as any);
  };

  const handleGoogleSignup = () => {
    // Navigate to Google OAuth screen
    router.push("./google-oauth" as any);
  };

  const handleUTEIDContinue = () => {
    router.push("./login" as any);
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