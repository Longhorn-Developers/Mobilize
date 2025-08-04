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
    <View
      className={`mx-auto flex-row items-center justify-center rounded-full bg-white px-4 py-1 ${className || ""}`}
    >
      {actions.map((action, index) => (
        <View key={action.label} className="flex-row items-center">
          <TouchableOpacity onPress={action.onPress}>
            <Text>{action.label}</Text>
          </TouchableOpacity>

          {/* Vertical separator line - only show if not the last item */}
          {index < actions.length - 1 && (
            <View className="mx-3 h-6 w-[2px] bg-ut-gray" />
          )}
        </View>
      ))}
    </View>
  );
}
