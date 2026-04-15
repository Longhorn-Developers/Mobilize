import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeftIcon } from "phosphor-react-native";

import colors from "~/types/colors";
import { apiClient } from "~/utils/api-client";

const MOBILITY_LABELS: Record<string, string> = {
  walking: "Walking",
  wheelchair: "Wheelchair / mobility aid",
  cane: "Using a cane",
  others: "Other",
};

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const insets = useSafeAreaInsets();

  const [data, setData] = useState<{ user: any; profile: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;
    apiClient
      .getPublicProfile(username)
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: insets.top }}>
        <ActivityIndicator size="large" color={colors.ut.burntorange} />
      </View>
    );
  }

  if (notFound || !data) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: insets.top }}>
        <Text className="text-lg text-gray-600">User not found.</Text>
        <TouchableOpacity className="mt-4" onPress={() => router.back()}>
          <Text className="text-ut-burntorange">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { user, profile } = data;
  const displayName = profile?.display_name ?? user.name ?? user.username ?? "User";
  const initial = displayName[0]?.toUpperCase() ?? "?";

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ paddingTop: insets.top }}
    >
      {/* Back button */}
      <TouchableOpacity
        className="px-6 pt-4 pb-2 flex-row items-center gap-2"
        onPress={() => router.back()}
      >
        <ArrowLeftIcon size={20} color={colors.ut.burntorange} />
        <Text className="text-ut-burntorange text-base">Back</Text>
      </TouchableOpacity>

      <View className="px-6">
        {/* Avatar + name */}
        <View className="mb-8 mt-4 items-center">
          <View className="h-24 w-24 items-center justify-center rounded-full bg-gray-300 mb-4">
            {user.image ? (
              <Image
                source={{ uri: user.image }}
                className="h-full w-full rounded-full"
              />
            ) : (
              <Text className="text-2xl text-gray-600">{initial}</Text>
            )}
          </View>
          <Text className="text-xl font-bold text-ut-black">{displayName}</Text>
          {user.username ? (
            <Text className="text-gray-600">@{user.username}</Text>
          ) : null}
          {user.role === "student" && (
            <View className="mt-2 rounded-full bg-ut-burntorange/10 px-3 py-1">
              <Text className="text-xs text-ut-burntorange font-medium">UT Student</Text>
            </View>
          )}
        </View>

        {/* Profile details */}
        {profile && (
          <View className="mb-8">
            <Text className="mb-4 text-lg font-semibold text-ut-black">Information</Text>

            {profile.class_year ? (
              <View className="mb-4">
                <Text className="text-sm text-gray-600">Class Year</Text>
                <Text className="text-base text-gray-900">{profile.class_year}</Text>
              </View>
            ) : null}

            {profile.major ? (
              <View className="mb-4">
                <Text className="text-sm text-gray-600">Major</Text>
                <Text className="text-base text-gray-900">{profile.major}</Text>
              </View>
            ) : null}

            {profile.bio ? (
              <View className="mb-4">
                <Text className="text-sm text-gray-600">Bio</Text>
                <Text className="text-base text-gray-900">{profile.bio}</Text>
              </View>
            ) : null}

            {profile.mobility_preference ? (
              <View className="mb-4">
                <Text className="text-sm text-gray-600">Mobility</Text>
                <Text className="text-base text-gray-900">
                  {MOBILITY_LABELS[profile.mobility_preference] ?? profile.mobility_preference}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {!profile && (
          <View className="mb-8 rounded-xl bg-gray-50 p-4">
            <Text className="text-center text-gray-500">
              This user hasn't set up their profile yet.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
