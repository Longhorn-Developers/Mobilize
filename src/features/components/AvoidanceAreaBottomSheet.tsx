import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { ForwardedRef } from "react";
import colors from "~/types/colors";
import type { AvoidanceArea } from "~/types/database";
import { useTheme } from "~/utils/ThemeContext";
import AvoidanceAreaDetails from "./AvoidanceAreaDetails";

interface PolygonData { area: AvoidanceArea; }

interface AvoidanceAreaBottomSheetProps {
  ref: ForwardedRef<BottomSheetModal>; }
  
const AvoidanceAreaBottomSheet = ({ ref }: AvoidanceAreaBottomSheetProps) => {
  const bottomTabBarHeight = useBottomTabBarHeight();
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  return (
    <BottomSheetModal<PolygonData>
      ref={ref}
      bottomInset={bottomTabBarHeight}
      backgroundStyle={{
        borderRadius: 32,
        backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
      }}
      enableDynamicSizing={false}
      snapPoints={["50%", "80%"]}
      handleIndicatorStyle={{
        backgroundColor: isDark ? "#52525B" : colors.theme.majorgridline,
        width: 80,
      }}
    >
      {({ data }) => {
        if (!data?.area) return;
        return <AvoidanceAreaDetails area={data.area} />;
      }}
    </BottomSheetModal>
  );
};

export default AvoidanceAreaBottomSheet;
