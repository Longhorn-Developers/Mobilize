import { Coordinates } from "expo-maps";
import React, { FC, useState } from "react";
import { View, Text, TextInput } from "react-native";
import { XIcon } from "phosphor-react-native";
import { Button } from "~/components/Button";
import EditRouteModal from "~/components/EditRouteModal";

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
  // should be current user location
  startLocation = undefined,
  // end location dependent on previous routing mode view
  endLocation = undefined,
  onExit,
}: NavigationViewProps) => {
  const [editMode, setEditMode] = useState(EditMode.default);
  const [searchInput, setSearchInput] = useState<string>(
    "Location from previous state",
  );

  const handleClose = () => {
    onExit();
  };

  const getEditRouteModal = (editMode: number, searchQuery: string) => (
    <EditRouteModal
      renderSearchBar={() => getLocationSearchBar(editMode, true)}
      onExit={() => {
        setEditMode(EditMode.default);
      }}
      searchQuery={searchQuery}
    />
  );

  const getLocationSearchBar = (editMode: number, autoFocus: boolean) => (
    <TextInput
      className="h-16 rounded-full bg-white px-5 pb-4 pt-5 align-text-top text-lg/none shadow-sm"
      onFocus={() => setEditMode(editMode)}
      autoFocus={autoFocus}
      placeholder={
        editMode === EditMode.Start ? "Start Location" : "Destination"
      }
      placeholderTextColor="gray"
      defaultValue={
        editMode === EditMode.Start
          ? "Default Start Location"
          : "Default End Location"
      }
      onChangeText={(text) => setSearchInput(text)}
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
          {getLocationSearchBar(EditMode.Start, false)}
          {/* Dotted Line */}
          <View className="ml-10 border-l-2 border-dashed border-white p-4"></View>
          {/* TODO: query end location name */}
          {getLocationSearchBar(EditMode.End, false)}
        </View>
      ) : (
        getEditRouteModal(editMode, searchInput)
      )}
    </View>
  );
};

export default NavigationView;
