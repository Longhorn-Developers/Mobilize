import { Coordinates } from "expo-maps";
import React, { ReactNode } from "react";
import { View, Text } from "react-native";
import LocationBookmark from "~/components/LocationBookmark";
import { Button } from "~/components/Button";
import { CaretRightIcon } from "phosphor-react-native";

// TODO: Store and fetch bookmarks from db
type tempPOI = {
  id?: number;
  name?: string;
  location?: Coordinates | undefined;
};
const bookmarks: tempPOI[] = [
  {
    id: 1,
    name: "Temporary Location",
    location: { longitude: 10, latitude: 20 },
  },
  {
    id: 2,
    name: "Another Location",
    location: { longitude: 20, latitude: 40 },
  },
];

interface EditRouteModalProps {
  className?: string;
  renderSearchBar: () => ReactNode;
  onExit: () => void;
}

const EditRouteModal = ({
  className,
  renderSearchBar,
  onExit,
}: EditRouteModalProps) => {
  const renderBookmarks = () =>
    // List all bookmark cards. Possible future TODO: add scrolling
    bookmarks.map((bookmark) => (
      <LocationBookmark
        key={bookmark.id}
        name={bookmark.name}
        location={bookmark.location}
      />
    ));

  return (
    <>
      {/* Modal View */}
      <View className="h-screen-safe mt-5 flex flex-col gap-2 bg-teal-500/20 p-4">
        {/* Search Bar */}
        {renderSearchBar && renderSearchBar()}
        {/* TODO: Dynamic Search Results */}
        <View className="rounded-xl bg-white px-5 py-4 shadow-sm">
          <Text className="text-lg color-[#64748b]">
            TODO: Dynamic Search Results with scroll
          </Text>
        </View>
        {/* Choose on Map */}
        <Button
          className="flex flex-row justify-between rounded-xl bg-white pl-6 shadow-sm"
          variant="ghost"
          title=""
          // TODO: map selection view
          onPress={() =>
            console.log("[EditRouteModal] Going to Map Selection View!")
          }
        >
          {/* Instruction */}
          <Text className="text-lg color-[#64748b]">Choose on map</Text>
          {/* Bookmark Options Button */}
          <Button
            // Doesn't do anything
            className="px-0"
            variant="ghost"
            title=""
            icon={<CaretRightIcon size={24} weight="bold" color="gray" />}
          />
        </Button>
        {/* Bookmarked Locations */}
        {renderBookmarks && renderBookmarks()}
      </View>
    </>
  );
};

export default EditRouteModal;
