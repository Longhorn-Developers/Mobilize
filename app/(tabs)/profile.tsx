import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import {
  MonitorIcon,
  MoonIcon,
  PencilSimpleLineIcon,
  SignInIcon,
  SignOutIcon,
  SunIcon,
} from "phosphor-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Switch,
  View,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "~/src/features/components/Button";
import colors from "~/types/colors";
import { apiClient } from "~/utils/api-client";
import {
  getStoredMapDetailMode,
  setStoredMapDetailMode,
  type MapDetailMode,
} from "~/utils/mapPreferences";
import { useTheme, type ThemeMode } from "~/utils/ThemeContext";
import { useAuth } from "~/utils/useAuth";

const SESSION_TOKEN_KEY = "auth_session_token";
const USER_KEY = "auth_user";

type StoredUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  username: string | null;
  role: string;
};

type ProfileData = {
  display_name: string;
  class_year: string | null;
  major: string | null;
  bio: string | null;
  mobility_preference: string | null;
  is_anonymous: boolean;
};

export default function ProfileTab() {
  const insets = useSafeAreaInsets();
  const { colorScheme, themeMode, setThemeMode } = useTheme();
  const { signOut } = useAuth();
  const isDark = colorScheme === "dark";

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [storedUser, setStoredUser] = useState<StoredUser | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [classYear, setClassYear] = useState("");
  const [major, setMajor] = useState("");
  const [bio, setBio] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [mapDetailMode, setMapDetailMode] = useState<MapDetailMode>("detailed");

  const [saved, setSaved] = useState({
    displayName: "",
    classYear: "",
    major: "",
    bio: "",
    isAnonymous: false,
  });

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const userJson = await AsyncStorage.getItem(USER_KEY);
      const token = await AsyncStorage.getItem(SESSION_TOKEN_KEY);
      const storedMapMode = await getStoredMapDetailMode();
      setMapDetailMode(storedMapMode);

      if (!userJson || !token) {
        setStoredUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setStoredUser(JSON.parse(userJson));

      const data = await apiClient.getMe();
      if (data.user) {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setStoredUser(data.user);
      }

      const p = data.profile as ProfileData | null;
      setProfile(p);

      const dn = p?.display_name ?? data.user?.name ?? "";
      const cy = p?.class_year ?? "";
      const maj = p?.major ?? "";
      const b = p?.bio ?? "";
      const anon = p?.is_anonymous ?? false;

      setDisplayName(dn);
      setClassYear(cy);
      setMajor(maj);
      setBio(b);
      setIsAnonymous(anon);
      setSaved({ displayName: dn, classYear: cy, major: maj, bio: b, isAnonymous: anon });
    } catch (err) {
      console.warn("Error loading profile:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const handleSave = async () => {
    try {
      await apiClient.updateProfile({
        displayName: displayName.trim(),
        classYear: classYear.trim() || undefined,
        major: major.trim() || undefined,
        bio: bio.trim() || undefined,
        isAnonymous,
      });
      const snap = {
        displayName: displayName.trim(),
        classYear: classYear.trim(),
        major: major.trim(),
        bio: bio.trim(),
        isAnonymous,
      };
      setSaved(snap);
      setIsEditing(false);
      Alert.alert("Saved", "Profile updated successfully.");
    } catch {
      Alert.alert("Error", "Could not save profile. Please try again.");
    }
  };

  const handleCancelEdit = () => {
    setDisplayName(saved.displayName);
    setClassYear(saved.classYear);
    setMajor(saved.major);
    setBio(saved.bio);
    setIsAnonymous(saved.isAnonymous);
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
          setStoredUser(null);
          setProfile(null);
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

  const isSignedIn = !!storedUser;
  const mobilityLabel = profile?.mobility_preference
    ? profile.mobility_preference.charAt(0).toUpperCase() + profile.mobility_preference.slice(1)
    : "Not set";

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

  if (isLoading) {
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
        {/* Header */}
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

        {/* Avatar + name */}
        <View className="mb-8 items-center">
          <View className="relative mb-4">
            <View className="h-24 w-24 items-center justify-center rounded-full bg-gray-300 dark:bg-neutral-700">
              {storedUser?.image ? (
                <Image
                  source={{ uri: storedUser.image }}
                  className="h-full w-full rounded-full"
                />
              ) : (
                <Text className="text-2xl text-gray-600 dark:text-gray-300">
                  {(displayName[0] ?? storedUser?.name?.[0] ?? "?").toUpperCase()}
                </Text>
              )}
            </View>
          </View>
          <Text className="text-xl font-bold text-ut-black dark:text-white">
            {displayName || storedUser?.name || "Your Profile"}
          </Text>
          {storedUser?.username ? (
            <Text className="text-gray-600 dark:text-gray-400">@{storedUser.username}</Text>
          ) : null}
          {storedUser?.email ? (
            <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">{storedUser.email}</Text>
          ) : null}
          {!isSignedIn && (
            <Text className="mt-2 text-sm italic text-gray-400 dark:text-gray-500">Not signed in</Text>
          )}
        </View>

        {/* Profile fields */}
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
                  <Text className="text-base text-gray-900 dark:text-gray-100">{value || "—"}</Text>
                )}
              </View>
            ))}

            <View className="mb-4">
              <Text className={labelClass}>Biography</Text>
              {isEditing ? (
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell us about yourself…"
                  placeholderTextColor="#9CA3AF"
                  className={inputClass}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              ) : (
                <Text className="text-base text-gray-900 dark:text-gray-100">{bio || "—"}</Text>
              )}
            </View>

            {/* Anonymous toggle */}
            <View className="flex-row items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800">
              <View className="flex-1 pr-4">
                <Text className="text-base font-medium text-gray-900 dark:text-white">
                  Appear anonymous
                </Text>
                <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  Hide your name and profile from other users
                </Text>
              </View>
              <Switch
                value={isAnonymous}
                onValueChange={(v) => {
                  setIsAnonymous(v);
                  if (!isEditing) {
                    // Save immediately when toggled outside of edit mode
                    apiClient.updateProfile({ isAnonymous: v }).catch(() =>
                      Alert.alert("Error", "Could not update anonymity setting.")
                    );
                  }
                }}
                trackColor={{ false: "#D1D5DB", true: "#BF5700" }}
                thumbColor="#FFFFFF"
                disabled={isEditing}
              />
            </View>
          </View>
        )}

        {/* Mobility Preferences */}
        {isSignedIn && (
          <View className="mb-8">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className={sectionTitleClass}>Mobility Preferences</Text>
              <TouchableOpacity onPress={() => router.push("../auth/mobility-preferences" as any)}>
                <PencilSimpleLineIcon size={16} color={colors.ut.burntorange} />
              </TouchableOpacity>
            </View>
            <View className={cardClass}>
              <Text className="text-sm text-gray-600 dark:text-gray-400">Movement style</Text>
              <Text className="text-base text-gray-900 dark:text-gray-100">{mobilityLabel}</Text>
            </View>
          </View>
        )}

        {/* Appearance */}
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

        {/* Action Buttons */}
        <View className="gap-3 pb-8">
          {isEditing ? (
            <>
              <Button title="Save Changes" onPress={handleSave} />
              <Button title="Cancel" variant="gray" onPress={handleCancelEdit} />
            </>
          ) : isSignedIn ? (
            <Button
              title="Sign Out" 
              variant="gray"
              onPress={handleSignOut}
              icon={<SignOutIcon size={20} color={isDark ? "#FFFFFF" : "#000000"} />} />
          ) : (
            <Button
              title="Sign In with Google"
              onPress={() => router.push("../welcome" as any)}
              icon={<SignInIcon size={20} color="white" />}
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}
