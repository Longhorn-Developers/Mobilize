import { ForwardedRef } from "react";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import colors from "~/types/colors";
import AvoidanceAreaDetails from "./AvoidanceAreaDetails";

interface PolygonData {
  id: string;
}

interface AvoidanceAreaBottomSheetProps {
  ref: ForwardedRef<BottomSheetModal>;
}

const AvoidanceAreaBottomSheet = ({ ref }: AvoidanceAreaBottomSheetProps) => {
  const bottomTabBarHeight = useBottomTabBarHeight();
  return (
    <BottomSheetModal<PolygonData>
      ref={ref}
      bottomInset={bottomTabBarHeight}
      backgroundStyle={{ borderRadius: 32 }}
      enableDynamicSizing={false}
      snapPoints={["50%", "80%"]}
      handleIndicatorStyle={{
        backgroundColor: colors.theme.majorgridline,
        width: 80,
      }}
    >
      {({ data }) => {
        if (!data || !data.id) return;
        return <AvoidanceAreaDetails areaId={data.id} />;
      }}
    </BottomSheetModal>
  );
};

export default AvoidanceAreaBottomSheet;
