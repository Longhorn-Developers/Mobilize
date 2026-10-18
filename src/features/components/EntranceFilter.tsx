import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";

import {
  ENTRANCE_FILTER_OPTIONS,
  type EntranceFilterKey,
} from "~/src/features/map/filters/entranceFilters";
import colors from "~/types/colors";
import { useTheme } from "~/utils/ThemeContext";
import { mapIcons } from "~/utils/useMapIcons";

// Layout
const BUTTON_WIDTH = 50;
const PANEL_MAX_WIDTH = 270;
const PANEL_RIGHT_MARGIN = 16;
const PANEL_RADIUS = 20;
const PANEL_PADDING = 12;
const TAG_GAP = 8;
const TAG_MIN_HEIGHT = 48;
const TAG_RADIUS = 999; 
const TAG_BORDER_WIDTH = 2;
const TAG_ICON_BOX = 28;
const TAG_ICON_IMAGE = 28;
const ICON_SIZE = 22; 
const BADGE_SIZE = 16;
const BADGE_OFFSET = 10;

// Each entrance type gets its own accent color.
const FILTER_COLORS: Record<EntranceFilterKey, string> = {
  autoDoor: "#00A9B7",   // Blue glow — Power-assisted doors
  manualDoor: "#BF5700", // Orange glow — Manual doors
  ramp: "#579D42",       // Green glow — Ramps
};

// Convert a hex color into an RGBA color for the selected overlay.
const hexToRgba = (hex: string, opacity: number) => {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Motion — swap for other reanimated presets, or set both to undefined to switch animation off
const PANEL_ENTERING = FadeInUp.duration(160);
const PANEL_EXITING = FadeOutUp.duration(120);

// Stacking — must sit above the map (the search row is at 20, the panel's backdrop must be below it)
const BACKDROP_Z_INDEX = 15;
const PANEL_Z_INDEX = 16;

// Colors
const getTokens = (isDark: boolean) => ({
  // Button (matches the search bar's surface)
  buttonBg: isDark ? "#262626" : "#FFFFFF",
  buttonIcon: isDark ? "#D1D5DB" : colors.ut.black,
  buttonActiveBg: colors.ut.burntorange,
  buttonActiveIcon: "#FFFFFF",
  badgeBg: "#6B7280",
  badgeText: "#FFFFFF",

  // Panel
  panelBg: "transparent",
  backdrop: "transparent",
  title: isDark ? "#9CA3AF" : "#6B7280",
  hint: isDark ? "#9CA3AF" : "#6B7280",
  accentText: isDark ? colors.ut.orange : colors.ut.burntorange,

  // Tags unselected
  tagBg: isDark ? "#2C2C2E" : "#FFFFFF",
  tagBorder: isDark ? "#52525B" : "#333F4833",
  tagText: isDark ? "#D1D5DB" : "#333F48",

  // Tags selected
  tagSelectedBg: "#BF5700",
  tagSelectedBorder: colors.ut.burntorange,
  tagSelectedText: isDark ? "#F3F4F6" : "#1A2024",
});

// Same floating-card shadow as the search bar
const cardShadow = (isDark: boolean, strong = false): ViewStyle => ({
  shadowColor: "#000",
  shadowOffset: { width: 0, height: strong ? 6 : 2 },
  shadowOpacity: isDark ? (strong ? 0.5 : 0.4) : strong ? 0.2 : 0.12,
  shadowRadius: strong ? 12 : 6,
  elevation: strong ? 8 : 4,
});

type EntranceFilterButtonProps = {
  isOpen: boolean;
  activeCount: number;
  onPress: () => void;
  style?: ViewStyle;
};

export const EntranceFilterButton = ({
  isOpen,
  activeCount,
  onPress,
  style,
}: EntranceFilterButtonProps) => {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const t = getTokens(isDark);
  const isActive = activeCount > 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Filter entrance types"
      accessibilityHint={isOpen ? "Closes the filter list" : "Opens the filter list"}
      accessibilityValue={{ text: isActive ? `${activeCount} selected` : "None selected" }}
      accessibilityState={{ expanded: isOpen }}
      style={[
        {
          width: BUTTON_WIDTH,
          height: BUTTON_WIDTH,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: BUTTON_WIDTH / 2,
          backgroundColor: t.buttonBg,
      
          ...(isOpen
            ? {
                shadowColor: "#BF5700",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.7,
                shadowRadius: 8,
                elevation: 8,
              }
            : cardShadow(isDark)),
        },
        style,
      ]}
    >
      <View style={{ width: ICON_SIZE, height: ICON_SIZE }}>
        <Image
          source={isOpen ? mapIcons.slider_orange : mapIcons.slider_black}
          style={{
            width: ICON_SIZE,
            height: ICON_SIZE,
            ...(!isOpen && isDark ? { tintColor: t.buttonIcon } : {}),
          }}
          resizeMode="contain"
        />

        {isActive && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: -BADGE_OFFSET,
              right: -BADGE_OFFSET,
              minWidth: BADGE_SIZE,
              height: BADGE_SIZE,
              paddingHorizontal: 4,
              borderRadius: BADGE_SIZE / 2,
              backgroundColor: t.badgeBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Inter",
                fontSize: 10,
                lineHeight: 12,
                fontWeight: "700",
                color: t.badgeText,
                includeFontPadding: false,
              }}
            >
              {activeCount}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

type EntranceFilterPanelProps = {
  visible: boolean;
  selected: readonly EntranceFilterKey[];
  onToggle: (key: EntranceFilterKey) => void;
  onClear: () => void;
  onDismiss: () => void;
  topOffset: number;
};

export const EntranceFilterPanel = ({
  visible,
  selected,
  onToggle,
  onClear,
  onDismiss,
  topOffset,
}: EntranceFilterPanelProps) => {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const t = getTokens(isDark);

  if (!visible) return null;

  return (
    <>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Close entrance filter"
        style={[StyleSheet.absoluteFill, { zIndex: BACKDROP_Z_INDEX, backgroundColor: t.backdrop }]}
      />

      <Animated.View
        entering={PANEL_ENTERING}
        exiting={PANEL_EXITING}
        onAccessibilityEscape={onDismiss}
        style={{
          position: "absolute",
          top: topOffset,
          right: PANEL_RIGHT_MARGIN,
          maxWidth: PANEL_MAX_WIDTH,
          zIndex: PANEL_Z_INDEX,
          padding: PANEL_PADDING,
          borderRadius: PANEL_RADIUS,
          backgroundColor: t.panelBg,
          ...cardShadow(isDark, true),
        }}
      >
        {/* Tags */}
        <View style={{ gap: TAG_GAP, alignItems: "flex-end" }}>
          {ENTRANCE_FILTER_OPTIONS.map((option, index) => {
              const isSelected = selected.includes(option.key);
              const selectedColor = FILTER_COLORS[option.key];

              return (
                <TouchableOpacity
                key={option.key}
                onPress={() => onToggle(option.key)}
                activeOpacity={0.8}
                accessibilityRole="checkbox"
                accessibilityLabel={option.label}
                accessibilityState={{ checked: isSelected }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  minHeight: TAG_MIN_HEIGHT,
                  paddingLeft: 10,
                  paddingRight: 16,
                  borderRadius: TAG_RADIUS,
                  borderWidth: TAG_BORDER_WIDTH,
              
                  backgroundColor: t.tagBg,
              
                  borderColor: isSelected ? selectedColor : t.tagBorder,
              
                  ...(isSelected
                    ? {
                        shadowColor: selectedColor,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: isDark ? 0.8 : 0.5,
                        shadowRadius: 8,
                        elevation: 8,
                      }
                    : {}),
              
                  position: "relative",
                }}
              >
                {isSelected && (
                  <View
                    pointerEvents="none"
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      borderRadius: TAG_RADIUS,
                      backgroundColor: hexToRgba(selectedColor, isDark ? 0.24 : 0.14),
                    }}
                  />
                )}
                <View
                  style={{
                    width: TAG_ICON_BOX,
                    height: TAG_ICON_BOX,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Image
                    source={mapIcons[option.icon]}
                    style={{ width: TAG_ICON_IMAGE, height: TAG_ICON_IMAGE }}
                    resizeMode="contain"
                  />
                </View>
                <Text
                  style={{
                    flexShrink: 1,
                    fontFamily: "Inter",
                    fontSize: 15,
                    fontWeight: isSelected ? "600" : "500",
                    color: isSelected ? t.tagSelectedText : t.tagText,
                  }}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </>
  );
};