import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  PencilSimpleLineIcon,
  SignOutIcon,
  SignInIcon,
} from "phosphor-react-native";

import { Button } from "~/components/Button";
import colors from "~/types/colors";
import { apiClient } from "~/utils/api-client";

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
};

export default function ProfileTab() {
  const insets = useSafeAreaInsets();

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [storedUser, setStoredUser] = useState<StoredUser | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  // Editable field state (mirrors profile fields)
  const [displayName, setDisplayName] = useState("");
  const [classYear, setClassYear] = useState("");
  const [major, setMajor] = useState("");
  const [bio, setBio] = useState("");

  // Snapshots for cancel
  const [saved, setSaved] = useState({
    displayName: "",
    classYear: "",
    major: "",
    bio: "",
  });

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const userJson = await AsyncStorage.getItem(USER_KEY);
      const token = await AsyncStorage.getItem(SESSION_TOKEN_KEY);

      if (!userJson || !token) {
        setStoredUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setStoredUser(JSON.parse(userJson));

      // Fetch fresh user + profile from server
      const data = await apiClient.getMe();
      if (data.user) {
        // Keep AsyncStorage user in sync
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setStoredUser(data.user);
      }

      const p = data.profile as ProfileData | null;
      setProfile(p);

      // Populate editable fields
      const dn = p?.display_name ?? data.user?.name ?? "";
      const cy = p?.class_year ?? "";
      const maj = p?.major ?? "";
      const b = p?.bio ?? "";

      setDisplayName(dn);
      setClassYear(cy);
      setMajor(maj);
      setBio(b);
      setSaved({ displayName: dn, classYear: cy, major: maj, bio: b });
    } catch (err) {
      console.warn("Error loading profile:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reload every time the tab is focused
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
      });
      const snap = {
        displayName: displayName.trim(),
        classYear: classYear.trim(),
        major: major.trim(),
        bio: bio.trim(),
      };
      setSaved(snap);
      setIsEditing(false);
      Alert.alert("Saved", "Profile updated successfully.");
    } catch (err) {
      Alert.alert("Error", "Could not save profile. Please try again.");
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
          const token = await AsyncStorage.getItem(SESSION_TOKEN_KEY);
          if (token) {
            const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
            await fetch(`${apiUrl}/api/auth/signout`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            }).catch(() => {});
          }
          await AsyncStorage.multiRemove([SESSION_TOKEN_KEY, USER_KEY]);
          setStoredUser(null);
          setProfile(null);
        },
      },
    ]);
  };

  const handleSignIn = () => {
    router.push("../auth/signup" as any);
  };

  const handleEditMobilityPreferences = () => {
    router.push("../auth/mobility-preferences" as any);
  };

  const isSignedIn = !!storedUser;
  const mobilityLabel = profile?.mobility_preference
    ? profile.mobility_preference.charAt(0).toUpperCase() + profile.mobility_preference.slice(1)
    : "Not set";

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: insets.top }}>
        <ActivityIndicator size="large" color="#BF5700" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ paddingTop: insets.top }}
    >
      <View className="px-6">
        {/* Header */}
        <View className="mb-8 mt-8 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-ut-black">Profile</Text>
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
            <View className="h-24 w-24 items-center justify-center rounded-full bg-gray-300">
              {storedUser?.image ? (
                <Image
                  source={{ uri: storedUser.image }}
                  className="h-full w-full rounded-full"
                />
              ) : (
                <Text className="text-2xl text-gray-600">
                  {(displayName[0] ?? storedUser?.name?.[0] ?? "?").toUpperCase()}
                </Text>
              )}
            </View>
          </View>
          <Text className="text-xl font-bold text-ut-black">
            {displayName || storedUser?.name || "Your Profile"}
          </Text>
          {storedUser?.username ? (
            <Text className="text-gray-600">@{storedUser.username}</Text>
          ) : null}
          {storedUser?.email ? (
            <Text className="mt-1 text-sm text-gray-500">{storedUser.email}</Text>
          ) : null}
          {!isSignedIn && (
            <Text className="mt-2 text-sm italic text-gray-400">Not signed in</Text>
          )}
        </View>

        {/* Fields */}
        {isSignedIn && (
          <View className="mb-8">
            <Text className="mb-4 text-lg font-semibold text-ut-black">Information</Text>

            {[
              { label: "Display Name", value: displayName, set: setDisplayName, placeholder: "Your name" },
              { label: "Class Year", value: classYear, set: setClassYear, placeholder: "e.g. Senior, 2026" },
              { label: "Major", value: major, set: setMajor, placeholder: "e.g. Computer Science" },
            ].map(({ label, value, set, placeholder }) => (
              <View key={label} className="mb-4">
                <Text className="mb-2 text-sm text-gray-600">{label}</Text>
                {isEditing ? (
                  <TextInput
                    value={value}
                    onChangeText={set}
                    placeholder={placeholder}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
                  />
                ) : (
                  <Text className="text-base text-gray-900">{value || "—"}</Text>
                )}
              </View>
            ))}

            <View className="mb-4">
              <Text className="mb-2 text-sm text-gray-600">Biography</Text>
              {isEditing ? (
                <TextInput
                  value={bio}
                  onChangeText={setBio}
                  placeholder="Tell us about yourself…"
                  className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              ) : (
                <Text className="text-base text-gray-900">{bio || "—"}</Text>
              )}
            </View>
          </View>
        )}

        {/* Mobility Preferences */}
        {isSignedIn && (
          <View className="mb-8">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-ut-black">Mobility Preferences</Text>
              <TouchableOpacity onPress={handleEditMobilityPreferences}>
                <PencilSimpleLineIcon size={16} color={colors.ut.burntorange} />
              </TouchableOpacity>
            </View>
            <View className="rounded-lg bg-gray-50 p-4">
              <Text className="text-sm text-gray-600">Movement style</Text>
              <Text className="text-base text-gray-900">{mobilityLabel}</Text>
            </View>
          </View>
        )}

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
              icon={<SignOutIcon size={20} color={colors.theme.staticblack} />}
            />
          ) : (
            <Button
              title="Sign In with Google"
              onPress={handleSignIn}
              icon={<SignInIcon size={20} color="white" />}
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}
