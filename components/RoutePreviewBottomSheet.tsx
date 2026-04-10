import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ForwardedRef } from "react";
import { View } from "react-native";

import colors from "~/types/colors";

interface RoutePreviewBottomSheetProps {
  ref: ForwardedRef<BottomSheetModal>;
}

interface RouteData {
  start: any; // POI? or just lat lng?
  end: any;
}

const RoutePreviewBottomSheet = ({ref}: RoutePreviewBottomSheetProps) => {
  const bottomTabBarHeight = useBottomTabBarHeight();

  return (
    <BottomSheetModal<RouteData>
      ref={ref}
      bottomInset={bottomTabBarHeight}
      backgroundStyle={{ borderRadius: 32 }}
      enableDynamicSizing={false}
      snapPoints={["50%", "80%"]}
      handleIndicatorStyle={{ backgroundColor: colors.theme.majorgridline, width: 80 }}
      enableContentPanningGesture={false}
    >
      <BottomSheetScrollView style={{ flex: 1 }}>
        <View
          className="p-6"
        >

        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

export default RoutePreviewBottomSheet;