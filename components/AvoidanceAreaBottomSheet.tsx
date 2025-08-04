import { ForwardedRef } from "react";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import colors from "~/types/colors";
import { AppleMapsPolygon } from "expo-maps/build/apple/AppleMaps.types";
import AvoidanceAreaDetails from "./AvoidanceAreaDetails";

interface AvoidanceAreaBottomSheetProps {
  ref: ForwardedRef<BottomSheetModal>;
}

const AvoidanceAreaBottomSheet = ({ ref }: AvoidanceAreaBottomSheetProps) => {
  const bottomTabBarHeight = useBottomTabBarHeight();
  return (
    <BottomSheetModal<AppleMapsPolygon>
      ref={ref}
      enableDynamicSizing={false}
      snapPoints={["50%", "80%"]}
      handleIndicatorStyle={{
        backgroundColor: colors.theme.majorgridline,
        width: 80,
      }}
      bottomInset={bottomTabBarHeight}
    >
      {({ data }) => {
        if (!data || !data.id) return;
        return <AvoidanceAreaDetails areaId={data.id} />;
      }}
    </BottomSheetModal>
  );
};

export default AvoidanceAreaBottomSheet;
