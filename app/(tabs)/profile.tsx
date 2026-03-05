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
import { 
  PencilSimpleLineIcon, 
  SignOutIcon,
} from "phosphor-react-native";

import { Button } from "~/components/Button";
import colors from "~/types/colors";

// Mock user data - replace with actual user context/API call
const mockUser = {
  id: 1,
  firstName: "Hao",
  lastName: "Huang",
  username: "haohuang",
  email: "hao.huang@utexas.edu",
  classYear: "Senior",
  major: "Computer Science",
  bio: "Passionate about accessibility and inclusive design. Love building apps that make campus life easier for everyone!",
  avatarUrl: null,
  mobilityPreferences: {
    incline: "mild",
    armRange: "full"
  }
};

export default function ProfileTab() {
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(mockUser.firstName);
  const [lastName, setLastName] = useState(mockUser.lastName);
  const [bio, setBio] = useState(mockUser.bio);
  
  const insets = useSafeAreaInsets();

  const handleSave = () => {
    // TODO: Implement save functionality
    console.log("Saving profile:", { firstName, lastName, bio });
    setIsEditing(false);
    Alert.alert("Success", "Profile updated successfully!");
  };

  const handleEditMobilityPreferences = () => {
    router.push("../auth/mobility-preferences" as any);
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Sign Out", 
          style: "destructive",
          onPress: () => {
            // TODO: Implement sign out logic
            router.replace("../auth/signup" as any);
          }
        }
      ]
    );
  };

  return (
    <ScrollView 
      className="flex-1 bg-white"
      contentContainerStyle={{ paddingTop: insets.top }}
    >
      <View className="px-6">
        {/* Header */}
        <View className="mb-8 mt-8 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-ut-black">Profile</Text>
          {!isEditing && (
            <TouchableOpacity 
              onPress={() => setIsEditing(true)}
              className="rounded-lg bg-ut-burntorange px-3 py-2"
            >
              <PencilSimpleLineIcon size={16} color="white" />
            </TouchableOpacity>
          )}
        </View>

        {/* Profile Picture and Basic Info */}
        <View className="mb-8 items-center">
          <View className="relative mb-4">
            <View className="h-24 w-24 items-center justify-center rounded-full bg-gray-300">
              {mockUser.avatarUrl ? (
                <Image
                  source={{ uri: mockUser.avatarUrl }}
                  className="h-full w-full rounded-full"
                />
              ) : (
                <Text className="text-2xl text-gray-600">
                  {firstName[0]?.toUpperCase()}
                </Text>
              )}
            </View>
            {isEditing && (
              <TouchableOpacity className="absolute bottom-0 right-0 rounded-full bg-ut-burntorange p-2">
                <PencilSimpleLineIcon size={16} color="white" />
              </TouchableOpacity>
            )}
          </View>
          
          <Text className="text-xl font-bold text-ut-black">
            {firstName} {lastName}
          </Text>
          <Text className="text-gray-600">@{mockUser.username}</Text>
          <Text className="mt-1 text-sm text-gray-500">{mockUser.email}</Text>
        </View>

        {/* Profile Information */}
        <View className="mb-8">
          <Text className="mb-4 text-lg font-semibold text-ut-black">Information</Text>
          
          {/* First Name */}
          <View className="mb-4">
            <Text className="mb-2 text-sm text-gray-600">First Name</Text>
            {isEditing ? (
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
              />
            ) : (
              <Text className="text-base text-gray-900">{firstName}</Text>
            )}
          </View>

          {/* Last Name */}
          <View className="mb-4">
            <Text className="mb-2 text-sm text-gray-600">Last Name</Text>
            {isEditing ? (
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
              />
            ) : (
              <Text className="text-base text-gray-900">{lastName}</Text>
            )}
          </View>

          {/* Class Year */}
          <View className="mb-4">
            <Text className="mb-2 text-sm text-gray-600">Class Year</Text>
            <Text className="text-base text-gray-900">{mockUser.classYear}</Text>
          </View>

          {/* Major */}
          <View className="mb-4">
            <Text className="mb-2 text-sm text-gray-600">Major</Text>
            <Text className="text-base text-gray-900">{mockUser.major}</Text>
          </View>

          {/* Bio */}
          <View className="mb-4">
            <Text className="mb-2 text-sm text-gray-600">Biography</Text>
            {isEditing ? (
              <TextInput
                value={bio}
                onChangeText={setBio}
                className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            ) : (
              <Text className="text-base text-gray-900">{bio}</Text>
            )}
          </View>
        </View>

        {/* Mobility Preferences Section */}
        <View className="mb-8">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-ut-black">Mobility Preferences</Text>
            <TouchableOpacity onPress={handleEditMobilityPreferences}>
              <PencilSimpleLineIcon size={16} color={colors.ut.burntorange} />
            </TouchableOpacity>
          </View>
          
          <View className="rounded-lg bg-gray-50 p-4">
            <View className="mb-3">
              <Text className="text-sm text-gray-600">Incline Preference</Text>
              <Text className="text-base text-gray-900">Avoid steep inclines</Text>
            </View>
            <View>
              <Text className="text-sm text-gray-600">Accessibility Needs</Text>
              <Text className="text-base text-gray-900">Full arm range</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="gap-3 pb-8">
          {isEditing ? (
            <>
              <Button title="Save Changes" onPress={handleSave} />
              <Button 
                title="Cancel" 
                variant="gray" 
                onPress={() => {
                  setIsEditing(false);
                  setFirstName(mockUser.firstName);
                  setLastName(mockUser.lastName);
                  setBio(mockUser.bio);
                }}
              />
            </>
          ) : (
            <Button 
              title="Sign Out" 
              variant="gray" 
              onPress={handleSignOut}
              icon={<SignOutIcon size={20} color={colors.theme.staticblack} />}
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}