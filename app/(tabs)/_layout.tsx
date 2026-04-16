import "~/global.css";

import { router, Tabs } from "expo-router";
import { MapPinIcon, UserIcon } from "phosphor-react-native";
import { useEffect } from "react";

import colors from "~/types/colors";
import { useTheme } from "~/utils/ThemeContext";
import { useAuth } from "~/utils/useAuth";

export default function Layout() {
  const { colorScheme } = useTheme();
  const { user, isAuthenticated, isLoading } = useAuth();

  // Guard authenticated users with incomplete setup back to profile onboarding.
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    if (!user?.username) {
      router.replace("/auth/profile-setup");
    }
  }, [isAuthenticated, isLoading, user?.username]);

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
