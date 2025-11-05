import { forwardRef, useState } from "react";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import colors from "~/types/colors";
import AvoidanceAreaDetails from "./AvoidanceAreaDetails";

// Define polygon type for react-native-maps
export interface MapPolygon {
  key: string;
  id?: string;
  coordinates: Array<{latitude: number; longitude: number}>;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
}

interface AvoidanceAreaBottomSheetProps {
  selectedAreaId?: string;
}

const AvoidanceAreaBottomSheet = forwardRef<BottomSheetModal, AvoidanceAreaBottomSheetProps>(({ selectedAreaId }, ref) => {
  const bottomTabBarHeight = useBottomTabBarHeight();
  
  return (
    <BottomSheetModal
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
      {selectedAreaId ? (
        <AvoidanceAreaDetails areaId={selectedAreaId} />
      ) : null}
    </BottomSheetModal>
  );
});

export default AvoidanceAreaBottomSheet;
