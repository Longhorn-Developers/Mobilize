import { View, Text, TouchableOpacity, ViewStyle } from "react-native";
import { MagnifyingGlassIcon } from "phosphor-react-native";
import colors from "~/types/colors";

interface SearchBarProps {
  onPress: () => void;
  placeholder?: string;
  className?: string;
  style?: ViewStyle;
}

export const SearchBar = ({ 
  onPress, 
  placeholder = "Where do you want to go?",
  className,
  style
}: SearchBarProps) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`flex-row items-center gap-3 rounded-full bg-white px-5 py-4 shadow-lg ${className}`}
      style={style}
    >
      {/* Search Icon */}
      <MagnifyingGlassIcon size={24} color={colors.ut.gray} weight="bold" />
      
      {/* Placeholder Text */}
      <Text className="flex-1 text-lg text-gray-400">
        {placeholder}
      </Text>
    </TouchableOpacity>
  );
};