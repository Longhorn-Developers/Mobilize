import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { CircleIcon, DotIcon, DotOutlineIcon, PencilSimpleIcon, PersonSimpleWalkIcon, WheelchairIcon } from "phosphor-react-native";
import { ForwardedRef, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { DottedLine } from "~/assets/map_icons/svg_icons";

import colors from "~/types/colors";

interface RoutePreviewBottomSheetProps {
  ref: ForwardedRef<BottomSheetModal>;
  routeData: RoutePreviewContentProps;
}

interface RoutePreviewContentProps {
  start: [number, number]; // lat, lng
  end: any; // selected poi
  building: any;
  entrances: any[];
}

const TravelModeButtons = ({
  className,
  selectedTravelMode,
  handleSelectTravelMode,
}: {
  className: string,
  selectedTravelMode: string,
  handleSelectTravelMode: (mode: string) => void,
}) => {
  const travelModes = ["wheelchair", "walking"];
  // const [selectedTravelMode, setSelectedTravelMode] = useState(selectedTravelMode);

  return (
    <View className={className}>
      {travelModes.map(mode => (
        <TouchableOpacity
          key={mode}
          className={`px-8 py-4 rounded-2xl ${mode === selectedTravelMode ? "bg-ut-burntorange" : "bg-gray-300"}`}
          onPress={() => {
            handleSelectTravelMode(mode);
            // setSelectedTravelMode(mode);
          }}
        >
          {mode === "wheelchair" && <WheelchairIcon size={24} color={mode === selectedTravelMode ? "white" : "gray"} />}
          {mode === "walking" && <PersonSimpleWalkIcon size={24} color={mode === selectedTravelMode ? "white" : "gray"} />}
          
        </TouchableOpacity>
      ))}
    </View>
  );
}

const RoutePreviewContent = ({
  start,
  end,
  building,
  entrances,
}: RoutePreviewContentProps) => {
  const [selectedTravelMode, setSelectedTravelMode] = useState("wheelchair");  // Pull initial mode from profile preferences

  const configBuildingName = (str: string) => {
    return str ? str
      .substring(6)
      .toLowerCase()
      .split(' ')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') : "Unknown Building";
  };

  const handleSelectTravelMode = (mode: string) => {
    setSelectedTravelMode(mode);
  }

  return (
    <BottomSheetScrollView style={{ flex: 1 }}>
      <View className="flex flex-col p-6 gap-4">
        {/* Heading (Building Name) */}
        <Text style={{ fontFamily: "Roboto Flex", fontWeight: "700", fontSize: 30.25, color: "#1A2024", marginBottom: 22 }}>
          {configBuildingName(end.bld_name)}
        </Text>

        {/* Travel Mode Buttons */}
        <TravelModeButtons
          className="flex flex-row gap-4"
          selectedTravelMode={selectedTravelMode}
          handleSelectTravelMode={handleSelectTravelMode}
        />

        {/* Start/End Location */}
        <View className="flex flex-col gap-2">
          {/* Start */}
          <View className="flex flex-row rounded-xl bg-gray-100 p-4 justify-between">
            <View className="flex flex-row gap-6 justify-center items-center pl-1">
              <TouchableOpacity
                // onPress={}  Edit start location
              >
                <CircleIcon size={12} weight="fill" color="#38BDF8" />
              </TouchableOpacity>
              <Text className="text-lg">My Location</Text>
            </View>
            <PencilSimpleIcon size={24} weight="fill" color="gray" />
          </View>
          {/* End */}
          <View className="flex flex-row rounded-xl bg-gray-100 p-4 justify-between">
            <View className="flex flex-row gap-6 justify-center items-center pl-1">
              <TouchableOpacity
                // onPress={}  Edit end location
              >
                <CircleIcon size={12} weight="fill" color="#BF5700" />
              </TouchableOpacity>
              <Text className="text-lg">{configBuildingName(end.bld_name)}</Text>
              <View className="rounded-full bg-ut-burntorange/20 border-2 border-ut-burntorange py-1 px-4">
                {/* entrance label - calculate using utils cardinal label functions */}
                <Text className="text-sm color-slate-500">North Entrance</Text>
              </View>
            </View>
            <PencilSimpleIcon size={24} weight="fill" color="gray" />
          </View>
          {/* Dotted Line thing */}
          <View className="absolute">
            <DottedLine
              height={50}
              thickness={1.5}
              color={colors.ut.burntorange}
              translateX={24}
              translateY={32}
              gapLength={7} />
          </View>
        </View>

        {/* Routes (Flatlist) */}
        {/* Data needed: */}
        {/* time, ETA, Go button, properties (stairs, curb cuts, etc), distance (for routing mode) */}
      </View>
    </BottomSheetScrollView>
  )
}

const RoutePreviewBottomSheet = ({ref, routeData}: RoutePreviewBottomSheetProps) => {
  const bottomTabBarHeight = useBottomTabBarHeight();

  return (
    <BottomSheetModal
      ref={ref}
      bottomInset={bottomTabBarHeight}
      backgroundStyle={{ borderRadius: 32 }}
      enableDynamicSizing={false}
      snapPoints={["50%", "80%"]}
      handleIndicatorStyle={{ backgroundColor: colors.theme.majorgridline, width: 80 }}
      enableContentPanningGesture={false}
    >
      <BottomSheetScrollView style={{ flex: 1 }}>
        <RoutePreviewContent
          start={routeData.start}
          end={routeData.end}
          building={routeData.building}
          entrances={routeData.entrances}          
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

export default RoutePreviewBottomSheet;