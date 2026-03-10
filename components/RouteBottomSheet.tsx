import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ForwardedRef } from "react";

import colors from "~/types/colors";


interface RouteContentProps {
    route: any;
}

const RouteContent = ({ route } : RouteContentProps) => {
    return (
        <></>
    )
}



interface RouteBottomSheetProps {
  ref: ForwardedRef<BottomSheetModal>;
}

interface RouteData {
    route: any;
}

const RouteBottomSheet = ({ ref }: RouteBottomSheetProps) => {
  const bottomTabBarHeight = useBottomTabBarHeight();

  return (
    <BottomSheetModal<RouteData>
      ref={ref}
      bottomInset={bottomTabBarHeight}
      backgroundStyle={{ borderRadius: 32 }}
      enableDynamicSizing={false}
      snapPoints={["50%"]}
      handleIndicatorStyle={{ backgroundColor: colors.theme.majorgridline, width: 80 }}
      enableContentPanningGesture={false}
    >
      {({ data }) => {
        if (!data?.route) return null;
        return <RouteContent route={data.route} />;
      }}
    </BottomSheetModal>
  );
};

export default RouteBottomSheet;