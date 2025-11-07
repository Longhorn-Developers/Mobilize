import { View, Text, TouchableOpacity } from "react-native";

import { cn } from "~/utils/utils";

interface ActionButtonItem {
  label: string;
  onPress: () => void;
  className?: string;
  textClassName?: string;
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
      className={cn(["flex-row items-center justify-center gap-1", className])}
    >
      {actions.map((action, index) => (
        <TouchableOpacity
          key={index}
          onPress={action.onPress}
          className={cn(["rounded-full bg-white px-4 py-2", action.className])}
        >
          <Text className={action.textClassName}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
