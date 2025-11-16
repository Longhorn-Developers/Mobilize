import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PencilSimpleLineIcon } from "phosphor-react-native";

import { Button } from "~/components/Button";
import colors from "~/types/colors";

export default function ProfileSetupScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [classYear, setClassYear] = useState("");
  const [major, setMajor] = useState("");
  const [bio, setBio] = useState("");
  const [hideNameFromPublic, setHideNameFromPublic] = useState(false);
  
  const insets = useSafeAreaInsets();

  const handleNext = () => {
    if (!firstName || !lastName || !username) {
      Alert.alert("Error", "Please fill in required fields");
      return;
    }
    
    // TODO: Save profile data
    console.log("Profile data:", {
      firstName,
      lastName,
      username,
      classYear,
      major,
      bio,
      hideNameFromPublic,
    });
    
    router.push("./mobility-preferences" as any);
  };

  return (
    <ScrollView 
      className="flex-1 bg-white"
      contentContainerStyle={{ paddingTop: insets.top }}
    >
      <View className="px-6">
        {/* Header */}
        <View className="mb-8 mt-8">
          <Text className="text-2xl font-bold text-ut-black">
            Set up your profile
          </Text>
        </View>

        {/* Profile Picture */}
        <View className="mb-6 items-center">
          <View className="relative">
            <View className="h-24 w-24 items-center justify-center rounded-full bg-gray-300">
              <Text className="text-2xl text-gray-600">H</Text>
            </View>
            <TouchableOpacity className="absolute bottom-0 right-0 rounded-full bg-ut-burntorange p-2">
              <PencilSimpleLineIcon size={16} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Form Fields */}
        <View className="gap-4">
          {/* First Name */}
          <View>
            <Text className="mb-2 text-sm text-gray-600">First Name</Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Enter your First Name"
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
            />
          </View>

          {/* Last Name */}
          <View>
            <Text className="mb-2 text-sm text-gray-600">Last Name</Text>
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Enter your Last Name"
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
            />
          </View>

          {/* Username */}
          <View>
            <Text className="mb-2 text-sm text-gray-600">Username</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username"
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
              autoCapitalize="none"
            />
          </View>

          {/* Class Year (Optional) */}
          <View>
            <Text className="mb-2 text-sm text-gray-600">Class (optional)</Text>
            <TextInput
              value={classYear}
              onChangeText={setClassYear}
              placeholder="Select your class year"
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
            />
          </View>

          {/* Major (Optional) */}
          <View>
            <Text className="mb-2 text-sm text-gray-600">Major (optional)</Text>
            <TextInput
              value={major}
              onChangeText={setMajor}
              placeholder="Enter your major"
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
            />
          </View>

          {/* Bio (Optional) */}
          <View>
            <Text className="mb-2 text-sm text-gray-600">Short biography (optional)</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Privacy Setting */}
          <TouchableOpacity 
            className="flex-row items-center py-4"
            onPress={() => setHideNameFromPublic(!hideNameFromPublic)}
          >
            <View className={`mr-3 h-5 w-5 rounded border-2 ${hideNameFromPublic ? 'bg-ut-burntorange border-ut-burntorange' : 'border-gray-300'}`}>
              {hideNameFromPublic && (
                <Text className="text-center text-xs text-white">✓</Text>
              )}
            </View>
            <Text className="text-gray-700">
              Don't show my name to the public
            </Text>
          </TouchableOpacity>
        </View>

        {/* Next Button */}
        <View className="mt-8 pb-8">
          <Button
            title="Next"
            onPress={handleNext}
            variant={firstName && lastName && username ? "primary" : "disabled"}
          />
        </View>
      </View>
    </ScrollView>
  );
}