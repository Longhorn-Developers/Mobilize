import React from "react";
import { View, Text, ScrollView, Switch, Platform, StyleSheet, Pressable } from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMapSettings } from "~/contexts/MapSettingsContext";
import { Gear, Moon, Sun } from "phosphor-react-native";

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { settings, setTheme, setMapType, setShowsTraffic, setShowsBuildings, setShowsCompass } = useMapSettings();

  const SettingItem = ({ 
    label, 
    value, 
    onValueChange, 
    disabled = false 
  }: { 
    label: string; 
    value: boolean; 
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
  }) => (
    <View style={styles.settingItem}>
      <Text style={[styles.settingLabel, { color: settings.theme === "dark" ? "#e5e7eb" : "#111827" }]}>
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: settings.theme === "dark" ? "#374151" : "#d1d5db", true: "#10b981" }}
        thumbColor={value ? "#fff" : "#f3f4f6"}
      />
    </View>
  );

  const MapTypeItem = ({ 
    type, 
    label 
  }: { 
    type: "standard" | "terrain" | "satellite" | "hybrid"; 
    label: string;
  }) => (
    <View
      style={[
        styles.mapTypeItem,
        {
          backgroundColor: settings.mapType === type 
            ? (settings.theme === "dark" ? "#374151" : "#f3f4f6") 
            : "transparent",
        },
      ]}
    >
      <Text
        style={[
          styles.mapTypeLabel,
          { color: settings.theme === "dark" ? "#e5e7eb" : "#111827" },
        ]}
      >
        {label} {settings.mapType === type ? "✓" : ""}
      </Text>
    </View>
  );

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: "Settings", 
          headerStyle: {
            backgroundColor: settings.theme === "dark" ? "#111827" : "white",
          },
          headerTintColor: settings.theme === "dark" ? "#e5e7eb" : "#111827",
        }} 
      />
      <ScrollView
        style={[
          styles.container,
          {
            backgroundColor: settings.theme === "dark" ? "#111827" : "#f9fafb",
          },
        ]}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
      >
        {/* Dark Mode Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            {settings.theme === "dark" ? (
              <Moon size={24} color="#e5e7eb" weight="duotone" />
            ) : (
              <Sun size={24} color="#111827" weight="duotone" />
            )}
            <Text
              style={[
                styles.sectionTitle,
                { color: settings.theme === "dark" ? "#e5e7eb" : "#111827" },
              ]}
            >
              Appearance
            </Text>
          </View>
          <View style={getSettingCardStyle(settings.theme)}>
            <SettingItem
              label="Dark Mode"
              value={settings.theme === "dark"}
              onValueChange={(value) => setTheme(value ? "dark" : "light")}
            />
          </View>
        </View>

        {/* Map Type Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Gear size={24} color={settings.theme === "dark" ? "#e5e7eb" : "#111827"} weight="duotone" />
            <Text
              style={[
                styles.sectionTitle,
                { color: settings.theme === "dark" ? "#e5e7eb" : "#111827" },
              ]}
            >
              Map Type
            </Text>
          </View>
          <View style={getSettingCardStyle(settings.theme)}>
            <Pressable onPress={() => setMapType("standard")}>
              <MapTypeItem type="standard" label="Standard" />
            </Pressable>
            <Pressable onPress={() => setMapType("terrain")}>
              <MapTypeItem type="terrain" label="Terrain" />
            </Pressable>
            <Pressable onPress={() => setMapType("satellite")}>
              <MapTypeItem type="satellite" label="Satellite" />
            </Pressable>
            <Pressable onPress={() => setMapType("hybrid")}>
              <MapTypeItem type="hybrid" label="Hybrid" />
            </Pressable>
          </View>
        </View>

        {/* Map Overlays Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Gear size={24} color={settings.theme === "dark" ? "#e5e7eb" : "#111827"} weight="duotone" />
            <Text
              style={[
                styles.sectionTitle,
                { color: settings.theme === "dark" ? "#e5e7eb" : "#111827" },
              ]}
            >
              Map Overlays
            </Text>
          </View>
          <View style={getSettingCardStyle(settings.theme)}>
            <SettingItem
              label="Traffic"
              value={settings.showsTraffic}
              onValueChange={setShowsTraffic}
            />
            <SettingItem
              label="Buildings"
              value={settings.showsBuildings}
              onValueChange={setShowsBuildings}
            />
            <SettingItem
              label="Compass"
              value={settings.showsCompass}
              onValueChange={setShowsCompass}
            />
          </View>
        </View>
      </ScrollView>
    </>
  );
}

const getSettingCardStyle = (theme: "light" | "dark") => ({
  backgroundColor: theme === "dark" ? "#1f2937" : "white",
  borderRadius: 12,
  padding: 16,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 2,
  elevation: 2,
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(243, 244, 246, 0.3)",
  },
  settingLabel: {
    fontSize: 16,
    flex: 1,
  },
  mapTypeItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  mapTypeLabel: {
    fontSize: 16,
  },
});

