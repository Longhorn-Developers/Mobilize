/** Tab bar layout for the main app — defines the Map and Profile tabs. Requires authenticated + onboarded user. */
import "~/global.css";

import { Tabs } from "expo-router";
import { HouseIcon, UserIcon } from "phosphor-react-native";

import colors from "~/types/colors";
import { useTheme } from "~/utils/ThemeContext";

export default function Layout() {
  const { colorScheme } = useTheme();
  const sizeMultiplier = 1.2; // increase icon size for better visibility
  const isDark = colorScheme === "dark";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.ut.burntorange,
        tabBarInactiveTintColor: isDark ? "#6B7280" : colors.ut.gray,
        tabBarStyle: {
          backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
          borderTopColor: isDark ? "#3A3A3C" : "#E5E7EB",
          height: 90,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Map",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => (
            <HouseIcon size={size * sizeMultiplier} color={color} />
          ),
        } as any}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <UserIcon size={size * sizeMultiplier} color={color} />,
        }}
      />
    </Tabs>
  );
}
