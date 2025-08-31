import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useQuery } from "@supabase-cache-helpers/postgrest-react-query";
import { WarningIcon } from "phosphor-react-native";
import { View, Text } from "react-native";
import colors from "~/types/colors";
import { supabase } from "~/utils/supabase";

const AvoidanceAreaDetails = ({ areaId }: { areaId: string }) => {
  const { data: avoidanceArea } = useQuery(
    supabase
      .from("avoidance_areas")
      .select("name")
      .eq("id", areaId)
      .single(),
  );

  return (
    <BottomSheetScrollView className="flex-1 px-8 py-4">
      {/* Heading Container */}
      <View className="flex-row items-center gap-4">
        {/* Icon Container */}
        <View className="rounded-lg bg-theme-red/20 p-3">
          <WarningIcon size={32} color={colors.theme.red} />
        </View>

        {/* Heading and subheading */}
        <View>
          <Text className="text-3xl font-bold">{avoidanceArea?.name}</Text>
          <Text className="text-lg font-medium">Temporary Blockage</Text>
        </View>
      </View>

      {/* Avoidance Area ID */}
      <View className="mt-4">
        <Text className="text-lg font-semibold">Avoidance Area ID:</Text>
        <Text className="text-lg">{areaId}</Text>
      </View>
    </BottomSheetScrollView>
  );
};

export default AvoidanceAreaDetails;
