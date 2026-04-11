import "~/global.css";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs } from "expo-router";
import { router } from "expo-router";
import { MapPinIcon, UserIcon } from "phosphor-react-native";
import { useEffect, useRef } from "react";

import colors from "~/types/colors";
import { useTheme } from "~/utils/ThemeContext";

export default function Layout() {
  const { colorScheme } = useTheme();
  const checked = useRef(false);

  // Step 3: Guard — redirect new users who bypassed onboarding back to profile-setup
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    AsyncStorage.multiGet(["auth_session_token", "auth_user"]).then(
      ([[, token], [, userJson]]) => {
        if (!token || !userJson) return; // unauthenticated users can still view the map
        try {
          const user = JSON.parse(userJson);
          if (!user.username) {
            router.replace("/auth/profile-setup");
          }
        } catch {}
      },
    );
  }, []);

  const isDark = colorScheme === "dark";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.ut.burntorange,
        tabBarInactiveTintColor: isDark ? "#6B7280" : colors.ut.gray,
        tabBarStyle: {
          backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
          borderTopColor: isDark ? "#3A3A3C" : "#E5E7EB",
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size }) => <MapPinIcon size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <UserIcon size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
