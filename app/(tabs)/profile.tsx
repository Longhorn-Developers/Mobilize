import { router, useFocusEffect } from "expo-router";
import {
  MonitorIcon,
  MoonIcon,
  PencilSimpleLineIcon,
  SignInIcon,
  SignOutIcon,
  SunIcon,
} from "phosphor-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "~/components/Button";
import colors from "~/types/colors";
import { apiClient } from "~/utils/api-client";
import {
  getStoredMapDetailMode,
  setStoredMapDetailMode,
  type MapDetailMode,
} from "~/utils/mapPreferences";
import { isLikelyNetworkError } from "~/utils/request-utils";
import { APP_ROUTES } from "~/utils/routes";
import { useTheme, type ThemeMode } from "~/utils/ThemeContext";
import { useAuth } from "~/utils/useAuth";

type ProfileData = {
  display_name: string;
  class_year: string | null;
  major: string | null;
  bio: string | null;
  mobility_preference: string | null;
};

export default function ProfileTab() {
  const insets = useSafeAreaInsets();
  const { colorScheme, themeMode, setThemeMode } = useTheme();
  const {
    user,
    profile: authProfile,
    isAuthenticated,
    isLoading: isAuthLoading,
    signOut,
    refreshSession,
  } = useAuth();

  const isDark = colorScheme === "dark";
  const profile = (authProfile as ProfileData | null) ?? null;

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [classYear, setClassYear] = useState("");
  const [major, setMajor] = useState("");
  const [bio, setBio] = useState("");
  const [mapDetailMode, setMapDetailMode] = useState<MapDetailMode>("detailed");

  const [saved, setSaved] = useState({
    displayName: "",
    classYear: "",
    major: "",
    bio: "",
  });

  useEffect(() => {
    if (isEditing) return;

    const dn = profile?.display_name ?? user?.name ?? "";
    const cy = profile?.class_year ?? "";
    const maj = profile?.major ?? "";
    const b = profile?.bio ?? "";

    setDisplayName(dn);
    setClassYear(cy);
    setMajor(maj);
    setBio(b);
    setSaved({
      displayName: dn,
      classYear: cy,
      major: maj,
      bio: b,
    });
  }, [isEditing, profile, user]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const loadMapMode = async () => {
        try {
          const storedMapMode = await getStoredMapDetailMode();
          if (active) {
            setMapDetailMode(storedMapMode);
          }
        } catch (error) {
          console.warn("Failed to load map detail mode:", error);
        }
      };

      void loadMapMode();
      return () => {
        active = false;
      };
    }, []),
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await apiClient.updateProfile({
        displayName: displayName.trim(),
        classYear: classYear.trim() || undefined,
        major: major.trim() || undefined,
        bio: bio.trim() || undefined,
      });
      await refreshSession();

      const snapshot = {
        displayName: displayName.trim(),
        classYear: classYear.trim(),
        major: major.trim(),
        bio: bio.trim(),
      };
      setSaved(snapshot);
      setIsEditing(false);
      Alert.alert("Saved", "Profile updated successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
      if (message.includes("401")) {
        Alert.alert("Session expired", "Please sign in again.");
        await signOut();
        router.replace(APP_ROUTES.WELCOME as any);
        return;
      }
      if (isLikelyNetworkError(error)) {
        Alert.alert(
          "Cannot reach server",
          "Saving changes timed out. Please confirm the API is available and try again.",
        );
        return;
      }
      Alert.alert("Error", "Could not save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setDisplayName(saved.displayName);
    setClassYear(saved.classYear);
    setMajor(saved.major);
    setBio(saved.bio);
    setIsEditing(false);
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          setIsEditing(false);
        },
      },
    ]);
  };

  const handleMapDetailModeChange = async (mode: MapDetailMode) => {
    try {
      setMapDetailMode(mode);
      await setStoredMapDetailMode(mode);
    } catch (error) {
      console.warn("Failed to save map detail mode:", error);
      Alert.alert("Could not save map mode", "Please try again.");
    }
  };

  const isSignedIn = isAuthenticated && Boolean(user);
  const shouldShowLoading = isAuthLoading && !user && !profile;

  const mobilityLabel = useMemo(() => {
    if (!profile?.mobility_preference) return "Not set";
    return (
      profile.mobility_preference.charAt(0).toUpperCase() +
      profile.mobility_preference.slice(1)
    );
  }, [profile?.mobility_preference]);

  const inputClass =
    "rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white";
  const cardClass = "rounded-lg bg-gray-50 p-4 dark:bg-neutral-800";
  const sectionTitleClass = "mb-4 text-lg font-semibold text-ut-black dark:text-white";
  const labelClass = "mb-2 text-sm text-gray-600 dark:text-gray-400";

  const appearanceModes: { mode: ThemeMode; label: string; Icon: any }[] = [
    { mode: "system", label: "System", Icon: MonitorIcon },
    { mode: "light", label: "Light", Icon: SunIcon },
    { mode: "dark", label: "Dark", Icon: MoonIcon },
  ];

  if (shouldShowLoading) {
    return (
      <View
        className="flex-1 items-center justify-center bg-white dark:bg-neutral-900"
        style={{ paddingTop: insets.top }}
      >
        <ActivityIndicator size="large" color="#BF5700" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-neutral-900"
      contentContainerStyle={{ paddingTop: insets.top }}
    >
      <View className="px-6">
        <View className="mb-8 mt-8 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-ut-black dark:text-white">Profile</Text>
          {isSignedIn && !isEditing && (
            <TouchableOpacity
              onPress={() => setIsEditing(true)}
              className="rounded-lg bg-ut-burntorange px-3 py-2"
            >
              <PencilSimpleLineIcon size={16} color="white" />
            </TouchableOpacity>
          )}
        </View>

        <View className="mb-8 items-center">
          <View className="relative mb-4">
            <View className="h-24 w-24 items-center justify-center rounded-full bg-gray-300 dark:bg-neutral-700">
              {user?.image ? (
                <Image source={{ uri: user.image }} className="h-full w-full rounded-full" />
              ) : (
                <Text className="text-2xl text-gray-600 dark:text-gray-300">
                  {(displayName[0] ?? user?.name?.[0] ?? "?").toUpperCase()}
                </Text>
              )}
            </View>
          </View>
          <Text className="text-xl font-bold text-ut-black dark:text-white">
            {displayName || user?.name || "Your Profile"}
          </Text>
          {user?.username ? (
            <Text className="text-gray-600 dark:text-gray-400">@{user.username}</Text>
          ) : null}
          {user?.email ? (
            <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">{user.email}</Text>
          ) : null}
          {!isSignedIn && (
            <Text className="mt-2 text-sm italic text-gray-400 dark:text-gray-500">Not signed in</Text>
          )}
        </View>

        {isSignedIn && (
          <View className="mb-8">
            <Text className={sectionTitleClass}>Information</Text>

            {[
              { label: "Display Name", value: displayName, set: setDisplayName, placeholder: "Your name" },
              { label: "Class Year", value: classYear, set: setClassYear, placeholder: "e.g. Senior, 2026" },
              { label: "Major", value: major, set: setMajor, placeholder: "e.g. Computer Science" },
            ].map(({ label, value, set, placeholder }) => (
              <View key={label} className="mb-4">
                <Text className={labelClass}>{label}</Text>
                {isEditing ? (
                  <TextInput
                    value={value}
                    onChangeText={set}
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    className={inputClass}
                  />
                ) : (
                  <Text className="text-base text-gray-900 dark:text-gray-100">{value || "-"}</Text>
                )}
              </View>
            ))}

            <View className="mb-4">
              <Text className={labelClass}>Biography</Text>
              {isEditing ? (
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell us about yourself..."
                  placeholderTextColor="#9CA3AF"
                  className={inputClass}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              ) : (
                <Text className="text-base text-gray-900 dark:text-gray-100">{bio || "-"}</Text>
              )}
            </View>

          </View>
        )}

        {isSignedIn && (
          <View className="mb-8">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className={sectionTitleClass}>Mobility Preferences</Text>
              <TouchableOpacity onPress={() => router.push(APP_ROUTES.AUTH_MOBILITY_PREFERENCES as any)}>
                <PencilSimpleLineIcon size={16} color={colors.ut.burntorange} />
              </TouchableOpacity>
            </View>
            <View className={cardClass}>
              <Text className="text-sm text-gray-600 dark:text-gray-400">Movement style</Text>
              <Text className="text-base text-gray-900 dark:text-gray-100">{mobilityLabel}</Text>
            </View>
          </View>
        )}

        <View className="mb-8">
          <Text className={sectionTitleClass}>Appearance</Text>
          <View className="flex-row gap-2">
            {appearanceModes.map(({ mode, label, Icon }) => {
              const active = themeMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  className={`flex-1 items-center gap-1.5 rounded-xl border py-3 ${
                    active
                      ? "border-ut-burntorange bg-orange-50 dark:bg-orange-950"
                      : "border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
                  }`}
                  onPress={() => setThemeMode(mode)}
                >
                  <Icon
                    size={18}
                    color={active ? colors.ut.burntorange : isDark ? "#9CA3AF" : "#6B7280"}
                  />
                  <Text
                    className={`text-xs font-medium ${
                      active ? "text-ut-burntorange" : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View className="mb-8">
          <Text className={sectionTitleClass}>Map View</Text>
          <Text className="mb-3 text-sm text-gray-600 dark:text-gray-400">
            Choose whether the map defaults to simple or detailed mode.
          </Text>
          <View className="flex-row gap-2">
            {(["simple", "detailed"] as const).map((mode) => {
              const active = mapDetailMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  className={`flex-1 items-center rounded-xl border py-3 ${
                    active
                      ? "border-ut-burntorange bg-orange-50 dark:bg-orange-950"
                      : "border-gray-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
                  }`}
                  onPress={() => void handleMapDetailModeChange(mode)}
                >
                  <Text
                    className={`text-sm font-semibold capitalize ${
                      active ? "text-ut-burntorange" : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {mode}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View className="gap-3 pb-8">
          {isEditing ? (
            <>
              <Button title="Save Changes" onPress={handleSave} disabled={isSaving} />
              <Button title="Cancel" variant="gray" onPress={handleCancelEdit} disabled={isSaving} />
            </>
          ) : isSignedIn ? (
            <Button
              title="Sign Out"
              variant="gray"
              onPress={handleSignOut}
              icon={<SignOutIcon size={20} color={isDark ? "#FFFFFF" : "#000000"} />}
            />
          ) : (
            <Button
              title="Sign In"
              onPress={() => router.push(APP_ROUTES.WELCOME as any)}
              icon={<SignInIcon size={20} color="white" />}
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}
