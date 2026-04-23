import { View, Text, TextInput, TouchableOpacity, ViewStyle } from "react-native";
import { MagnifyingGlassIcon, XIcon } from "phosphor-react-native";
import colors from "~/types/colors";
import { useTheme } from "~/utils/ThemeContext";

interface SearchBarProps {
  onPress?: () => void;
  onChangeText?: (text: string) => void;
  onClear?: () => void;
  value?: string;
  placeholder?: string;
  className?: string;
  style?: ViewStyle;
  editable?: boolean;
  isActive?: boolean;
}

export const SearchBar = ({
  onPress,
  onChangeText,
  onClear,
  value = "",
  placeholder = "Where do you want to go?",
  className,
  style,
  editable = false,
  isActive = false,
}: SearchBarProps) => {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";
  const containerBase = `flex-row items-center gap-3 rounded-full px-5 py-3 shadow-lg ${className}`;
  const bg = isDark ? "bg-neutral-800" : "bg-white";
  const iconColor = isDark ? "#6B7280" : colors.ut.gray;

  if (!editable) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        className={`${containerBase} ${bg}`}
        style={style}
      >
        <MagnifyingGlassIcon size={20} color={iconColor} weight="bold" />
        <Text className={`flex-1 text-base ${isDark ? "text-gray-500" : "text-gray-400"}`}>
          {placeholder}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View
      className={`${containerBase} ${bg}`}
      style={style}
    >
      <MagnifyingGlassIcon size={20} color={iconColor} weight="bold" />
      <TextInput
        className={`flex-1 text-base ${isDark ? "text-gray-100" : "text-gray-900"}`}
        placeholder={placeholder}
        placeholderTextColor={iconColor}
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
