import { Coordinates } from "expo-maps";
import React, { FC, useState } from "react";
import { View, Text, Button, TextInput } from "react-native";
import { XIcon } from "phosphor-react-native";

enum EditMode {
  default,
  Start,
  End,
}

interface EditRouteViewProps {
  title?: string;
  startLocation?: Coordinates | undefined;
  endLocation?: Coordinates | undefined;
  className?: string;
}

const NavigationView = ({
  className,
  startLocation = undefined,
  endLocation = undefined,
}: EditRouteViewProps) => {
  const [editMode, setEditMode] = useState(EditMode.default);

  return (
    // Wrapper View
    <View className={`flex flex-col ${className}`}>
      {/* Title Block */}
      <View className="mt-20 flex w-full flex-row justify-between bg-ut-burntorange px-7 py-5">
        <Text className="text-2xl font-semibold text-white">
          {editMode === EditMode.default
            ? "Edit Route"
            : editMode === EditMode.Start
              ? "Edit Start Location"
              : "Edit End Location"}
        </Text>
        <XIcon size={28} color="white" weight="bold" />
      </View>
      {/* Location Search Bars */}
      <View className="flex w-full flex-col justify-between bg-ut-burntorange px-7 pb-7">
        {/* TODO: query start location name */}
        <TextInput
          className="rounded-full bg-white px-6 pb-4 pt-3 align-text-top text-lg shadow-sm"
          onFocus={() => setEditMode(EditMode.Start)}
          placeholder="Start Location"
          placeholderTextColor="gray"
        />
        {/* Dotted Line */}
        <View className="ml-10 border-l-2 border-dashed border-white p-4"></View>
        {/* TODO: query end location name */}
        <TextInput
          className="rounded-full bg-white px-6 pb-4 pt-3 align-text-top text-lg shadow-sm"
          onFocus={() => setEditMode(EditMode.End)}
          placeholder="Destination"
          placeholderTextColor="gray"
          defaultValue="!Queried Location!"
        />
      </View>
    </View>
  );
};

export default NavigationView;
