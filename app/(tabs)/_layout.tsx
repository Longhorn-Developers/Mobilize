import "~/global.css";

import { Tabs } from "expo-router";
import { UserIcon, MapPinIcon } from "phosphor-react-native";
import colors from "~/types/colors";

export default function Layout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.ut.burntorange,
        tabBarInactiveTintColor: colors.ut.gray,
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
