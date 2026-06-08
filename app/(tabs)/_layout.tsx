import "~/global.css";

import { router, Tabs } from "expo-router";
import { MapPinIcon, UserIcon } from "phosphor-react-native";
import { useEffect } from "react";

import colors from "~/types/colors";
import { useTheme } from "~/utils/ThemeContext";
import { useAuth } from "~/utils/useAuth";

export default function Layout() {
  const { colorScheme } = useTheme();
  const { isAuthenticated, isLoading, onboardingComplete } = useAuth();

  // Guard authenticated users with incomplete setup back to profile onboarding.
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    if (!onboardingComplete) {
      router.replace("../auth/profile-setup" as any);
    }
  }, [isAuthenticated, isLoading, onboardingComplete]);

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
          unmountOnBlur: true,
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <MapPinIcon size={size} color={color} />
          ),
        } as any}
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
