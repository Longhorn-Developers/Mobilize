import { View, Text, TouchableOpacity } from "react-native";

interface ActionButtonItem {
  label: string;
  onPress: () => void;
}

interface ActionButtonGroupProps {
  actions: ActionButtonItem[];
  className?: string;
}

export function ActionButtonGroup({
  actions,
  className,
}: ActionButtonGroupProps) {
  return (
    <View className={`flex-row items-center justify-center gap-1 ${className}`}>
      {actions.map((action, index) => (
        <TouchableOpacity
          key={index}
          onPress={action.onPress}
          className={`rounded-full bg-white px-4 py-2`}
        >
          <Text>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
