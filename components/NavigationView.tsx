import { Coordinates } from "expo-maps";
import React, { FC, useState } from "react";
import { View, Text, TextInput } from "react-native";
import { XIcon } from "phosphor-react-native";
import { Button } from "~/components/Button";
import EditRouteModal from "./EditRouteModal";

enum EditMode {
  default,
  Start,
  End,
}

interface NavigationViewProps {
  title?: string;
  startLocation?: Coordinates | undefined;
  endLocation?: Coordinates | undefined;
  className?: string;
  onExit: () => void;
}

const NavigationView = ({
  className,
  startLocation = undefined,
  endLocation = undefined,
  onExit,
}: NavigationViewProps) => {
  const [editMode, setEditMode] = useState(EditMode.default);

  const handleClose = () => {
    onExit();
  };

  const getEditRouteModal = (editMode: number) => (
    <EditRouteModal
      renderSearchBar={() => getLocationSearchBar(editMode)}
      onExit={() => {
        setEditMode(EditMode.default);
      }}
    />
  );

  const getLocationSearchBar = (editMode: number) =>
    editMode === EditMode.Start ? (
      <TextInput
        className="rounded-full bg-white px-6 pb-4 pt-3 align-text-top text-lg shadow-sm"
        onFocus={() => setEditMode(EditMode.Start)}
        placeholder="Start Location"
        placeholderTextColor="gray"
      />
    ) : (
      <TextInput
        className="rounded-full bg-white px-6 pb-4 pt-3 align-text-top text-lg shadow-sm"
        onFocus={() => setEditMode(EditMode.End)}
        placeholder="Destination"
        placeholderTextColor="gray"
        defaultValue="!Queried Location!"
      />
    );

  return (
    // Wrapper View
    <View className={`flex w-full flex-col ${className}`}>
      {/* Title Block */}
      <View className="mt-20 flex flex-row items-center justify-between bg-ut-burntorange py-3 pl-7">
        <Text className="text-2xl font-semibold text-white">
          {editMode === EditMode.default
            ? "Edit Route"
            : editMode === EditMode.Start
              ? "Edit Start Location"
              : "Edit End Location"}
        </Text>
        <Button
          variant="ghost"
          title=""
          onPress={handleClose}
          icon={<XIcon size={28} color="white" weight="bold" />}
        />
      </View>
      {/* Location Search Bars */}
      {editMode === EditMode.default ? (
        <View className="flex w-full flex-col justify-between bg-ut-burntorange px-5 pb-7">
          {/* TODO: query start location name */}
          {getLocationSearchBar(EditMode.Start)}
          {/* Dotted Line */}
          <View className="ml-10 border-l-2 border-dashed border-white p-4"></View>
          {/* TODO: query end location name */}
          {getLocationSearchBar(EditMode.End)}
        </View>
      ) : (
        getEditRouteModal(editMode)
      )}
    </View>
  );
};

export default NavigationView;
