/** Step 1 of onboarding: user sets display name, username, and optional bio. Requires authenticated session. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { PencilSimpleLineIcon } from "phosphor-react-native";
import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert,
  ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/src/features/components/Button";
import { apiClient } from "~/utils/api-client";
import { isLikelyNetworkError } from "~/utils/request-utils";
import { APP_ROUTES } from "~/utils/routes";
import { useAuth, SESSION_TOKEN_KEY, USER_KEY } from "~/utils/useAuth";

export default function ProfileSetupScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [classYear, setClassYear] = useState("");
  const [major, setMajor] = useState("");
  const [bio, setBio] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading: isAuthLoading, refreshSession, signOut } = useAuth();

  const normalizeUsername = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_.-]/g, "");

  const handleNext = async () => {
    if (!firstName.trim() || !lastName.trim() || !username.trim()) {
      Alert.alert("Error", "First name, last name, and username are required.");
      return;
    }

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedUsername = normalizeUsername(username);
    if (!trimmedUsername) {
      Alert.alert("Error", "Please choose a valid username.");
      return;
    }
    const displayName = `${trimmedFirstName} ${trimmedLastName}`;

    setIsSaving(true);
    try {
      await apiClient.createProfile({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        username: trimmedUsername,
        classYear: classYear.trim() || undefined,
        major: major.trim() || undefined,
        bio: bio.trim() || undefined,
      });

      const cachedUser = await AsyncStorage.getItem(USER_KEY);
      if (cachedUser) {
        try {
          const parsedUser = JSON.parse(cachedUser);
          await AsyncStorage.setItem(
            USER_KEY,
            JSON.stringify({
              ...parsedUser,
              name: displayName,
              username: trimmedUsername,
            }),
          );
        } catch {}
      }

      await refreshSession();

      const token = await AsyncStorage.getItem(SESSION_TOKEN_KEY);
      if (!token) {
        Alert.alert("Session expired", "Please sign in again to continue onboarding.");
        router.replace(APP_ROUTES.WELCOME as any);
        return;
      }

      router.replace(APP_ROUTES.AUTH_MOBILITY_PREFERENCES as any);
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (msg.includes("401")) {
        Alert.alert("Session expired", "Please sign in again to continue onboarding.");
        await signOut();
        router.replace(APP_ROUTES.WELCOME as any);
        return;
      }
      if (isLikelyNetworkError(err)) {
        Alert.alert(
          "Cannot reach server",
          "Saving your profile timed out. Please confirm the API is running and try again.",
        );
        return;
      }
      if (msg.includes("409") || msg.toLowerCase().includes("username")) {
        Alert.alert("Username taken", "That username is already in use. Please choose another.");
      } else {
        Alert.alert("Error", "Could not save your profile. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const canProceed = Boolean(firstName.trim() && lastName.trim() && normalizeUsername(username));

  const inputClass =
    "rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white";

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-neutral-900"
      contentContainerStyle={{ paddingTop: insets.top }}
    >
      <View className="px-6">
        {/* Header */}
        <View className="mb-8 mt-8">
          <Text className="text-2xl font-bold text-ut-black dark:text-white">
            Set up your profile
          </Text>
        </View>

        {/* Profile Picture placeholder */}
        <View className="mb-6 items-center">
          <View className="relative">
            <View className="h-24 w-24 items-center justify-center rounded-full bg-gray-300 dark:bg-neutral-700">
              <Text className="text-2xl text-gray-600 dark:text-gray-300">
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
          {[
            { label: "First Name *", value: firstName, set: setFirstName, placeholder: "Enter your First Name" },
            { label: "Last Name *", value: lastName, set: setLastName, placeholder: "Enter your Last Name" },
            { label: "Username *", value: username, set: setUsername, placeholder: "Enter your username", lower: true },
            { label: "Class Year (optional)", value: classYear, set: setClassYear, placeholder: "e.g. Senior, 2026" },
            { label: "Major (optional)", value: major, set: setMajor, placeholder: "Enter your major" },
          ].map(({ label, value, set, placeholder, lower }) => (
            <View key={label}>
              <Text className="mb-2 text-sm text-gray-600 dark:text-gray-400">{label}</Text>
              <TextInput
                value={value}
                onChangeText={(text) => set(lower ? normalizeUsername(text) : text)}
                placeholder={placeholder}
                placeholderTextColor="#9CA3AF"
                className={inputClass}
                autoCapitalize={lower ? "none" : "words"}
                autoCorrect={false}
              />
            </View>
          ))}

          <View>
            <Text className="mb-2 text-sm text-gray-600 dark:text-gray-400">Short biography (optional)</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              placeholderTextColor="#9CA3AF"
              className={inputClass}
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
              disabled={!canProceed || isSaving || isAuthLoading || !isAuthenticated}
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}
