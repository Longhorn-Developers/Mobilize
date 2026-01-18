import { MagnifyingGlassIcon, XIcon } from "phosphor-react-native";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ViewStyle,
} from "react-native";

import colors from "~/types/colors";

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
  // If not editable, render as a touchable button
  if (!editable) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        className={`flex-row items-center gap-3 rounded-full bg-white px-5 py-3 shadow-lg ${className}`}
        style={style}
      >
        <MagnifyingGlassIcon size={20} color={colors.ut.gray} weight="bold" />
        <Text className="flex-1 text-base text-gray-400">{placeholder}</Text>
      </TouchableOpacity>
    );
  }

  // If editable, render with TextInput
  return (
    <View
      className={`flex-row items-center gap-3 rounded-full bg-white px-5 py-3 shadow-lg ${className}`}
      style={style}
    >
      <MagnifyingGlassIcon size={20} color={colors.ut.gray} weight="bold" />
      <TextInput
        className="flex-1 text-base text-gray-900"
        placeholder={placeholder}
        placeholderTextColor={colors.ut.gray}
        value={value}
        onChangeText={onChangeText}
        autoFocus
        returnKeyType="search"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={onClear} activeOpacity={0.7}>
          <XIcon size={20} color={colors.ut.gray} />
        </TouchableOpacity>
      )}
    </View>
  );
};
