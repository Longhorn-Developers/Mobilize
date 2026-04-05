import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Button } from "~/components/Button";
import { apiClient } from "~/utils/api-client";

type MobilityOption = {
  id: string;
  title: string;
};

const mobilityOptions: MobilityOption[] = [
  { id: "walking", title: "Walking" },
  { id: "wheelchair", title: "Using a wheelchair or mobility aid" },
  { id: "cane", title: "Using a cane" },
  { id: "others", title: "Others" },
];

export default function MobilityPreferencesScreen() {
  const [selectedOption, setSelectedOption] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    AsyncStorage.getItem("auth_user").then((json) => {
      if (json) {
        const user = JSON.parse(json);
        setUserName(user.name?.split(" ")[0] ?? "");
      }
    });
  }, []);

  const handleNext = async () => {
    if (!selectedOption) {
      router.replace("../" as any);
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.updateProfile({ mobilityPreference: selectedOption });
    } catch (err) {
      // Non-blocking — we navigate regardless
      console.warn("Could not save mobility preference:", err);
    } finally {
      setIsSaving(false);
      router.replace("/(tabs)");
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ paddingTop: insets.top }}
    >
      <View className="px-6">
        {/* Header */}
        <View className="mb-8 mt-8">
          <Text className="text-xl font-medium text-center text-gray-900">
            Hi {userName || "there"}, let's get to know more about you!
          </Text>
        </View>

        {/* Question */}
        <View className="mb-8">
          <Text className="text-lg font-medium text-gray-900 mb-6">
            How do you usually move around campus?
          </Text>

          <View className="gap-4">
            {mobilityOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                className={`flex-row items-center rounded-lg border p-4 ${
                  selectedOption === option.id
                    ? "border-ut-burntorange bg-orange-50"
                    : "border-gray-200 bg-white"
                }`}
                onPress={() => setSelectedOption(option.id)}
              >
                <View
                  className={`h-5 w-5 rounded-full border-2 mr-4 items-center justify-center ${
                    selectedOption === option.id
                      ? "border-ut-burntorange bg-ut-burntorange"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {selectedOption === option.id && (
                    <View className="h-2 w-2 rounded-full bg-white" />
                  )}
                </View>
                <Text className="flex-1 text-base text-gray-900">
                  {option.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bottom section */}
        <View className="flex-1 justify-end pb-8">
          <Text className="text-center text-sm text-gray-500 mb-6">
            You can change this anytime in Profile
          </Text>

          {isSaving ? (
            <ActivityIndicator size="large" color="#BF5700" />
          ) : (
            <Button
              title={selectedOption ? "Save & Continue" : "Skip for now"}
              onPress={handleNext}
              variant="primary"
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}
