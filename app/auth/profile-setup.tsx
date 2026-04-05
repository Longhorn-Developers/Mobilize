import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PencilSimpleLineIcon } from "phosphor-react-native";

import { Button } from "~/components/Button";
import { apiClient } from "~/utils/api-client";

export default function ProfileSetupScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [classYear, setClassYear] = useState("");
  const [major, setMajor] = useState("");
  const [bio, setBio] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const insets = useSafeAreaInsets();

  const handleNext = async () => {
    if (!firstName.trim() || !lastName.trim() || !username.trim()) {
      Alert.alert("Error", "First name, last name, and username are required.");
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.createProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        classYear: classYear.trim() || undefined,
        major: major.trim() || undefined,
        bio: bio.trim() || undefined,
      });
      router.push("./mobility-preferences" as any);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (msg.includes("409") || msg.toLowerCase().includes("username")) {
        Alert.alert("Username taken", "That username is already in use. Please choose another.");
      } else {
        Alert.alert("Error", "Could not save your profile. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const canProceed = firstName.trim() && lastName.trim() && username.trim();

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

        {/* Profile Picture placeholder */}
        <View className="mb-6 items-center">
          <View className="relative">
            <View className="h-24 w-24 items-center justify-center rounded-full bg-gray-300">
              <Text className="text-2xl text-gray-600">
                {firstName[0]?.toUpperCase() ?? "?"}
              </Text>
            </View>
            <TouchableOpacity className="absolute bottom-0 right-0 rounded-full bg-ut-burntorange p-2">
              <PencilSimpleLineIcon size={16} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Form Fields */}
        <View className="gap-4">
          <View>
            <Text className="mb-2 text-sm text-gray-600">First Name *</Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Enter your First Name"
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
            />
          </View>

          <View>
            <Text className="mb-2 text-sm text-gray-600">Last Name *</Text>
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Enter your Last Name"
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
            />
          </View>

          <View>
            <Text className="mb-2 text-sm text-gray-600">Username *</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username"
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View>
            <Text className="mb-2 text-sm text-gray-600">Class Year (optional)</Text>
            <TextInput
              value={classYear}
              onChangeText={setClassYear}
              placeholder="e.g. Senior, 2026"
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
            />
          </View>

          <View>
            <Text className="mb-2 text-sm text-gray-600">Major (optional)</Text>
            <TextInput
              value={major}
              onChangeText={setMajor}
              placeholder="Enter your major"
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
            />
          </View>

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
        </View>

        {/* Next Button */}
        <View className="mt-8 pb-8">
          {isSaving ? (
            <ActivityIndicator size="large" color="#BF5700" />
          ) : (
            <Button
              title="Next"
              onPress={handleNext}
              variant={canProceed ? "primary" : "disabled"}
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}
