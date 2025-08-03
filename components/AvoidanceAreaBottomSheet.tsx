import { ForwardedRef } from "react";
import { Text, View } from "react-native";
import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import colors from "~/types/colors";
import { WarningIcon } from "phosphor-react-native";

interface AvoidanceAreaBottomSheetProps {
  ref: ForwardedRef<BottomSheetModal>;
}

const AvoidanceAreaBottomSheet = ({ ref }: AvoidanceAreaBottomSheetProps) => {
  const bottomTabBarHeight = useBottomTabBarHeight();

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing={false}
      snapPoints={["50%", "80%"]}
      handleIndicatorStyle={{
        backgroundColor: colors.theme.majorgridline,
        width: 80,
      }}
      bottomInset={bottomTabBarHeight}
    >
      <BottomSheetScrollView className="flex-1 px-8 py-4">
        {/* Heading Container */}
        <View className="flex-row items-center gap-4">
          {/* Icon Container */}
          <View className="rounded-lg bg-theme-red/20 p-3">
            <WarningIcon size={32} color={colors.theme.red} />
          </View>

          {/* Heading and subheading */}
          <View>
            <Text className="text-4xl font-bold">Avoidance Area</Text>
            <Text className="text-lg font-medium">Temporary Blockage</Text>
          </View>
        </View>

        {/* Avoidance Area ID */}
        <View className="mt-4">
          <Text className="text-lg font-semibold">Avoidance Area ID:</Text>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
};

export default AvoidanceAreaBottomSheet;
