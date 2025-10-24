import { Coordinates } from "expo-maps";
import { BookmarkSimpleIcon, DotsThreeIcon } from "phosphor-react-native";
import React from "react";
import { View, Text } from "react-native";
import { Button } from "~/components/Button";

interface BookmarkProps {
  name?: string;
  location: Coordinates | undefined;
}

const LocationBookmark = ({ name, location }: BookmarkProps) => {
  return (
    // Bookmark card
    <Button
      className="flex flex-row justify-between rounded-xl bg-white shadow-sm"
      variant="ghost"
      title=""
      // TODO: update start or destination
      onPress={() =>
        console.log(location?.latitude + " " + location?.longitude)
      }
    >
      {/* Name and Bookmark Icon */}
      <View className="flex flex-row items-center gap-2">
        <BookmarkSimpleIcon size={28} weight="fill" color="gray" />
        <Text className="text-lg color-[#64748b]">{name}</Text>
      </View>
      {/* Bookmark Options Button */}
      <Button
        // Doesn't do anything right now
        className="px-0"
        variant="ghost"
        title=""
        icon={<DotsThreeIcon size={28} weight="bold" color="gray" />}
      />
    </Button>
  );
};

export default LocationBookmark;
