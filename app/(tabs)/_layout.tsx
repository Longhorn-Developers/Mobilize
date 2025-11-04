import React from "react";
import "~/global.css";
import { Tabs } from "expo-router";
import { Gear, MapPin } from "phosphor-react-native";
import { useMapSettings } from "~/contexts/MapSettingsContext";

export default function Layout() {
  const { settings } = useMapSettings();
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#f97316",
        tabBarInactiveTintColor: settings.theme === "dark" ? "#9ca3af" : "#6b7280",
        headerShown: false,
        tabBarStyle: {
          backgroundColor: settings.theme === "dark" ? "#111827" : "white",
          borderTopColor: settings.theme === "dark" ? "#374151" : "#e5e7eb",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <MapPin size={size} color={color} weight="duotone" />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Gear size={size} color={color} weight="duotone" />,
        }}
      />
    </Tabs>
  );
}
