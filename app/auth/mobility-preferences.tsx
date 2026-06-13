/** Step 2 of onboarding: user selects mobility preference (walking / wheelchair / cane / other). Requires authenticated session. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "~/components/Button";
import { apiClient } from "~/utils/api-client";
import { isLikelyNetworkError } from "~/utils/request-utils";
import { APP_ROUTES } from "~/utils/routes";
import { useAuth } from "~/utils/useAuth";

type MobilityOption = { id: string; title: string };

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
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
    refreshSession,
    signOut,
  } = useAuth();

  useEffect(() => {
    AsyncStorage.getItem("auth_user").then((json) => {
      if (json) {
        const user = JSON.parse(json);
        setUserName(user.name?.split(" ")[0] ?? "");
      }
    });
  }, []);

  const handleNext = async () => {
    if (!isAuthenticated) {
      Alert.alert("Session expired", "Please sign in again.");
      router.replace(APP_ROUTES.WELCOME as any);
      return;
    }

    setIsSaving(true);
    try {
      if (selectedOption) {
        await apiClient.updateProfile({
          mobilityPreference: selectedOption,
          onboardingComplete: true,
        });
      } else {
        await apiClient.updateProfile({ onboardingComplete: true });
      }
      await refreshSession();
      const token = await AsyncStorage.getItem("auth_session_token");
      if (!token) {
        Alert.alert("Session expired", "Please sign in again to continue.");
        router.replace(APP_ROUTES.WELCOME as any);
        return;
      }
      const refreshedMe = await apiClient.getMe().catch(() => null);
      if (!refreshedMe?.onboardingComplete) {
        Alert.alert(
          "Profile not finished",
          "We could not confirm onboarding completion yet. Please try again.",
        );
        return;
      }
      router.replace(APP_ROUTES.TABS as any);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err ?? "Unknown error");
      if (message.includes("401")) {
        Alert.alert("Session expired", "Please sign in again to finish onboarding.");
        await signOut();
        router.replace(APP_ROUTES.WELCOME as any);
        return;
      }
      if (isLikelyNetworkError(err)) {
        Alert.alert(
          "Cannot reach server",
          "Saving your preference timed out. Please check your connection and API server, then try again.",
        );
        return;
      }
      console.warn("Could not save mobility preference:", err);
      Alert.alert("Could not save preference", "Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-neutral-900"
      contentContainerStyle={{ paddingTop: insets.top }}
    >
      <View className="px-6">
        {/* Header */}
        <View className="mb-8 mt-8">
          <Text className="text-center text-xl font-medium text-gray-900 dark:text-white">
            Hi {userName || "there"}, let us get to know more about you!
          </Text>
        </View>

        {/* Question */}
        <View className="mb-8">
          <Text className="mb-6 text-lg font-medium text-gray-900 dark:text-white">
            How do you usually move around campus?
          </Text>

          <View className="gap-4">
            {mobilityOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                className={`flex-row items-center rounded-lg border p-4 ${
                  selectedOption === option.id
                    ? "border-ut-burntorange bg-orange-50 dark:bg-orange-950"
                    : "border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
                }`}
                onPress={() => setSelectedOption(option.id)}
              >
                <View
                  className={`mr-4 h-5 w-5 items-center justify-center rounded-full border-2 ${
                    selectedOption === option.id
                      ? "border-ut-burntorange bg-ut-burntorange"
                      : "border-gray-300 bg-white dark:border-neutral-600 dark:bg-neutral-700"
                  }`}
                >
                  {selectedOption === option.id && (
                    <View className="h-2 w-2 rounded-full bg-white" />
                  )}
                </View>
                <Text
                  className={`flex-1 text-base ${
                    selectedOption === option.id
                      ? "text-ut-burntorange"
                      : "text-gray-900 dark:text-white"
                  }`}
                >
                  {option.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bottom */}
        <View className="flex-1 justify-end pb-8">
          <Text className="mb-6 text-center text-sm text-gray-500 dark:text-gray-400">
            You can change this anytime in Profile
          </Text>

          {isSaving ? (
            <ActivityIndicator size="large" color="#BF5700" />
          ) : (
          <Button
              title={selectedOption ? "Save & Continue" : "Skip for now"}
              onPress={handleNext}
              variant="primary"
              disabled={isSaving || isAuthLoading || !isAuthenticated}
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}
