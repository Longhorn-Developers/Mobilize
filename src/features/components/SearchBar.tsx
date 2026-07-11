import { MagnifyingGlassIcon, XIcon } from "phosphor-react-native";
import { View, TextInput, TouchableOpacity, ViewStyle, StyleSheet } from "react-native";

import colors from "~/types/colors";
import { useTheme } from "~/utils/ThemeContext";

interface SearchBarProps {
  onPress?: () => void;
  onChangeText?: (text: string) => void;
  onClear?: () => void;
  value?: string;
  placeholder?: string;
  style?: ViewStyle;
  editable?: boolean;
  isActive?: boolean;
  // className is kept for API compatibility but positioning must use style prop
  className?: string;
}

export const SearchBar = ({
  onPress,
  onChangeText,
  onClear,
  value = "",
  placeholder = "Where do you want to go?",
  style,
  editable = false,
  isActive = false,
}: SearchBarProps) => {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const iconColor = isDark ? "#6B7280" : colors.ut.gray;
  const bg = isDark ? "#262626" : "#FFFFFF";
  const textColor = isDark ? "#F3F4F6" : "#111827";
  const placeholderColor = isDark ? "#6B7280" : "#9CADB7";

  const containerStyle: ViewStyle = {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: bg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.4 : 0.12,
    shadowRadius: 6,
    elevation: 4,
  };

  if (!editable) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[containerStyle, style]}
      >
        <MagnifyingGlassIcon size={20} color={iconColor} weight="bold" />
        <View style={styles.flex1}>
          <TextInput
            style={[styles.text, { color: placeholderColor }]}
            value={placeholder}
            editable={false}
            pointerEvents="none"
          />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[containerStyle, style]}>
      <MagnifyingGlassIcon size={20} color={iconColor} weight="bold" />
      <TextInput
        style={[styles.flex1, styles.text, { color: textColor }]}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        value={value}
        onChangeText={onChangeText}
        autoFocus
        returnKeyType="search"
      />
      {(isActive || value.length > 0) && (
        <TouchableOpacity onPress={onClear} activeOpacity={0.7}>
          <XIcon size={20} color={iconColor} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  text: { fontSize: 16, fontFamily: "Inter" },
});
