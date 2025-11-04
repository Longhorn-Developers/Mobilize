import { forwardRef } from "react";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { View, Text, Pressable, Platform } from "react-native";
import colors from "~/types/colors";

interface MapLayersBottomSheetProps {
  theme: "light" | "dark";
  mapType: "standard" | "terrain" | "satellite" | "hybrid";
  showsTraffic: boolean;
  showsBuildings: boolean;
  showsIndoors: boolean;
  showsIndoorLevelPicker: boolean;
  onMapTypeChange: (type: "standard" | "terrain" | "satellite" | "hybrid") => void;
  onToggleTraffic: () => void;
  onToggleBuildings: () => void;
  onToggleIndoors: () => void;
  onToggleIndoorLevelPicker: () => void;
}

const MapLayersBottomSheet = forwardRef<BottomSheetModal, MapLayersBottomSheetProps>(
  (
    {
      theme,
      mapType,
      showsTraffic,
      showsBuildings,
      showsIndoors,
      showsIndoorLevelPicker,
      onMapTypeChange,
      onToggleTraffic,
      onToggleBuildings,
      onToggleIndoors,
      onToggleIndoorLevelPicker,
    },
    ref
  ) => {
    const bottomTabBarHeight = useBottomTabBarHeight();

    return (
      <BottomSheetModal
        ref={ref}
        bottomInset={bottomTabBarHeight}
        index={0}
        snapPoints={["40%", "60%"]}
        backgroundStyle={{
          borderRadius: 32,
          backgroundColor: theme === "dark" ? "#111827" : "white",
        }}
        enablePanDownToClose={true}
        handleIndicatorStyle={{
          backgroundColor: theme === "dark" ? "#374151" : colors.theme.majorgridline,
          width: 80,
        }}
      >
        <View style={{ padding: 20 }}>
          <Text
            style={{
              fontWeight: "600",
              fontSize: 20,
              color: theme === "dark" ? "#e5e7eb" : "#111827",
              marginBottom: 16,
            }}
          >
            Map Type
          </Text>
          {(["standard", "terrain", "satellite", "hybrid"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => onMapTypeChange(t)}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 8,
                borderRadius: 8,
                backgroundColor: mapType === t ? (theme === "dark" ? "#374151" : "#f3f4f6") : "transparent",
              }}
            >
              <Text
                style={{
                  color: theme === "dark" ? "#e5e7eb" : "#111827",
                  fontSize: 16,
                }}
              >
                {t[0].toUpperCase() + t.slice(1)} {mapType === t ? "✓" : ""}
              </Text>
            </Pressable>
          ))}

          <View style={{ height: 24 }} />

          <Text
            style={{
              fontWeight: "600",
              fontSize: 20,
              color: theme === "dark" ? "#e5e7eb" : "#111827",
              marginBottom: 16,
            }}
          >
            Overlays
          </Text>
          {[
            ["Traffic", showsTraffic, onToggleTraffic],
            ["Buildings", showsBuildings, onToggleBuildings],
            ["Indoors", showsIndoors, onToggleIndoors],
            ...(Platform.OS === "android"
              ? [["Indoor Level Picker", showsIndoorLevelPicker, onToggleIndoorLevelPicker] as const]
              : []),
          ].map(([label, value, setter]) => (
            <Pressable
              key={label}
              onPress={setter}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 8,
                borderRadius: 8,
                backgroundColor: value ? (theme === "dark" ? "#374151" : "#f3f4f6") : "transparent",
              }}
            >
              <Text
                style={{
                  color: theme === "dark" ? "#e5e7eb" : "#111827",
                  fontSize: 16,
                }}
              >
                {label} {value ? "✓" : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      </BottomSheetModal>
    );
  }
);

MapLayersBottomSheet.displayName = "MapLayersBottomSheet";

export default MapLayersBottomSheet;

