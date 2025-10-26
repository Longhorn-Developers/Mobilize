import { Coordinates } from "expo-maps";
import React, { ReactNode, useState } from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import LocationBookmark from "~/components/LocationBookmark";
import { Button } from "~/components/Button";
import { CaretRightIcon } from "phosphor-react-native";
import { supabase } from "~/utils/supabase";
import { useQuery } from "@supabase-cache-helpers/postgrest-react-query";
import { Point } from "@types/geojson";

// Buildings
type BuildingProps = {
  building: BuildingData;
  onPress: () => void;
  className: string;
};

const Building = ({ building, onPress, className }: BuildingProps) => (
  <TouchableOpacity onPress={onPress}>
    <Text className={`${className}`}>{building.bld_name}</Text>
  </TouchableOpacity>
);

type BuildingData = {
  id: string;
  bld_name: string;
  rel_POIs: string[];
  location_geojson: Point;
};

type BookmarkData = {
  id: string;
  label: string;
  location_geojson: Point;
};

interface EditRouteModalProps {
  className?: string;
  renderSearchBar: () => ReactNode;
  onExit: () => void;
  searchQuery: string;
}

const EditRouteModal = ({
  className,
  renderSearchBar,
  onExit,
  searchQuery,
}: EditRouteModalProps) => {
  const [isLocationSelected, setIsLocationSelected] = useState<boolean>(false);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingData>();

  const { data: POIs } = useQuery(
    supabase.from("pois").select("id, poi_type, metadata, location_geojson"),
    {
      staleTime: 1000 * 60 * 60, // 1 hour
    },
  );

  // List of buildings for search query
  const buildingsMap: Map<string, BuildingData> = new Map<
    string,
    BuildingData
  >();

  // Compile building data
  let id_index = 0;
  POIs?.forEach((POI) => {
    const bld_name: string = POI.metadata.bld_name;
    if (buildingsMap.has(bld_name)) {
      const storedBuilding: BuildingData = buildingsMap.get(
        bld_name,
      ) as BuildingData;
      // Average location of POIs related to a building
      storedBuilding.location_geojson.coordinates[0] *=
        storedBuilding.rel_POIs.length;
      storedBuilding.location_geojson.coordinates[1] *=
        storedBuilding.rel_POIs.length;
      storedBuilding.rel_POIs = [...POI.id];
      storedBuilding.location_geojson.coordinates[0] /=
        storedBuilding.rel_POIs.length;
      storedBuilding.location_geojson.coordinates[1] /=
        storedBuilding.rel_POIs.length;
    } else {
      buildingsMap.set(bld_name, {
        id: "" + id_index,
        bld_name: bld_name,
        rel_POIs: [POI.id],
        location_geojson: POI.location_geojson,
      });
      id_index++;
    }
  });
  const buildings: BuildingData[] = [...buildingsMap.values()];

  const renderSearchResults = ({ item }: { item: BuildingData }) => {
    return (
      <Building
        building={item}
        onPress={() => {
          console.log("[EditRouteModal] Search result selected!");
          setSelectedBuilding(item);
          preprocessRelPOIs(item);
          setIsLocationSelected(true);
        }}
        className="text-lg color-[#64748b]"
      />
    );
  };

  const preprocessRelPOIs = (building: BuildingData) => {};

  // Temporary list of bookmarks. TODO: have a way to create new bookmarks/query from db
  const bookmarks: BookmarkData[] = [
    {
      id: "temp01",
      label: "PSY Class",
      location_geojson: { type: "Point", coordinates: [-97.735, 30.28] },
    },
    {
      id: "temp02",
      label: "Union Building",
      location_geojson: { type: "Point", coordinates: [-97.738, 30.285] },
    },
  ];

  const renderBookmark = ({ item }: { item: BookmarkData }) => {
    // List all bookmark cards. Possible future TODO: add scrolling
    return (
      <LocationBookmark
        key={item.id}
        name={item.label}
        location={item.location_geojson}
        getEntranceSelection={() => setIsLocationSelected(true)}
      />
    );
  };

  const renderEntranceButton = ({ item }: { item: BuildingData }) => {
    // TODO: query nearby POIs (for the purpose of listing icons)

    // List all available entrances as buttons
    return (
      <Button
        // Doesn't do anything right now
        key={item.id} // Will eventuall by appropriate location ID
        variant="primary"
        className="rounded-e-full rounded-s-full border-2 border-ut-burntorange bg-white shadow-none"
      >
        <Text className="color-[#64748b]">Name of entrance</Text>
        {/* TODO: list appropriate icons */}
        {/* Generate appropriate icons given the entrance */}
      </Button>
    );
  };

  return (
    <>
      {/* Modal View */}
      <View className="h-screen-safe mt-5 flex flex-col gap-2 bg-teal-500/20 p-4">
        {/* Search Bar */}
        {renderSearchBar && renderSearchBar()}
        {!isLocationSelected ? (
          // Location Selection Options (search, find on map, bookmarks)
          <>
            {/* Dynamic Search Results */}
            <View className="rounded-xl bg-white px-5 py-4 shadow-sm">
              <FlatList
                data={buildings.filter(
                  (element) =>
                    element.bld_name &&
                    element.bld_name.includes(searchQuery?.toUpperCase()),
                )}
                renderItem={renderSearchResults}
                className="max-h-36"
                persistentScrollbar={true}
                ItemSeparatorComponent={() => <View className="h-8" />}
              />
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
            <FlatList
              data={bookmarks}
              renderItem={renderBookmark}
              ItemSeparatorComponent={() => <View className="h-2" />}
            />
          </>
        ) : (
          // Change Entrance Options
          <View className="flex flex-col gap-2 rounded-xl bg-white px-5 py-4 shadow-sm">
            {/* Heading */}
            <Text className="text-lg color-[#64748b]">Change Entrance</Text>
            {/* Entrance Buttons */}
            {/* TODO: query POIs on boundary of given building. How to group POIs for button? */}
            {/* <FlatList
              data={selectedBuilding?.rel_POIs}
              renderItem={renderEntranceButton}
            /> */}
            <Text>Temporary Text: {selectedBuilding?.bld_name}</Text>
          </View>
        )}
      </View>
    </>
  );
};

export default EditRouteModal;
