import { ActivityIndicator, View } from "react-native";

export default function RootRoute() {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
      <ActivityIndicator size="large" color="#BF5700" />
    </View>
  );
}
