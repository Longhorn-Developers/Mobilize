import { Coordinates } from "expo-maps";
import React, { ReactNode, useState } from "react";
import { View, Text, FlatList } from "react-native";
import LocationBookmark from "~/components/LocationBookmark";
import { Button } from "~/components/Button";
import { CaretRightIcon } from "phosphor-react-native";
import { supabase } from "~/utils/supabase";
import { useQuery } from "@supabase-cache-helpers/postgrest-react-query";
import { Point } from "@types/geojson";

// TODO: Store and fetch bookmarks from db
type tempPOI = {
  id?: number;
  name?: string;
  location?: Coordinates | undefined;
  entrances?: string[];
};

type BuildingProps = {
  building: BuildingData;
  onPress: () => void;
  className: string;
};

const Building = ({ building, onPress, className }: BuildingProps) => (
  <View>
    <Text className={`${className}`}>{building.bld_name}</Text>
  </View>
);

type BuildingData = {
  id: string;
  bld_name: string;
  location_geojson: Point;
  POI_count: number;
};

const bookmarks: tempPOI[] = [
  {
    id: 1,
    name: "Temporary Location",
    location: { longitude: 10, latitude: 20 },
    entrances: ["South Entrance", "North Entrance"],
  },
  {
    id: 2,
    name: "Another Location",
    location: { longitude: 20, latitude: 40 },
    entrances: ["West Entrance"],
  },
];

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
  const RESULTS_RENDER_LIMIT = 20;

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

  // Iterate through every POI to generate a map of building names to building data
  POIs?.forEach((POI) => {
    const bld_name: string = POI.metadata.bld_name;
    if (buildingsMap.has(bld_name)) {
      const storedBuilding: BuildingData = buildingsMap.get(
        bld_name,
      ) as BuildingData;
      // Average location of POIs related to a building
      storedBuilding.location_geojson.coordinates[0] *=
        storedBuilding.POI_count;
      storedBuilding.location_geojson.coordinates[1] *=
        storedBuilding.POI_count++;
      storedBuilding.location_geojson.coordinates[0] /=
        storedBuilding.POI_count;
      storedBuilding.location_geojson.coordinates[1] /=
        storedBuilding.POI_count;
      storedBuilding.id += POI.id;
    } else {
      buildingsMap.set(bld_name, {
        id: POI.id,
        bld_name: bld_name,
        location_geojson: POI.location_geojson,
        POI_count: 1,
      });
    }
  });
  const buildings: BuildingData[] = [...buildingsMap.values()];

  const renderSearchResults = ({ item }: { item: BuildingData }) => {
    return (
      <Building
        building={item}
        onPress={() => console.log("Button Pressed!")}
        className="text-lg color-[#64748b]"
      />
    );
  };

  const renderBookmark = (bookmark: tempPOI) => {
    // List all bookmark cards. Possible future TODO: add scrolling
    return (
      <LocationBookmark
        key={bookmark.id}
        name={bookmark.name}
        location={bookmark.location}
        getEntranceSelection={() => setIsLocationSelected(true)}
      />
    );
  };

  let i = 0;
  const renderEntranceButton = ({
    selectedLocation,
  }: {
    selectedLocation: tempPOI;
  }) => {
    // List all available entrances as buttons
    return (
      <Button
        // Doesn't do anything right now
        key={i++} // Will eventuall by appropriate location ID
        variant="primary"
        className="rounded-e-full rounded-s-full border-2 border-ut-burntorange bg-white shadow-none"
      >
        <Text className="color-[#64748b]">{selectedLocation.name}</Text>
        {/* TODO: list appropriate icons */}
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
          // Location Selection Options
          <>
            {/* Dynamic Search Results */}
            <View className="rounded-xl bg-white px-5 py-4 shadow-sm">
              {/* <Text className="text-lg color-[#64748b]">
                TODO: Dynamic Search Results with scroll
              </Text> */}
              <FlatList
                data={buildings
                  .filter(
                    (element) =>
                      element.bld_name &&
                      element.bld_name.includes(searchQuery?.toUpperCase()),
                  )
                  .slice(0, RESULTS_RENDER_LIMIT)}
                renderItem={renderSearchResults}
                className="max-h-36"
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
            {/* Implement a FlatList */}
          </>
        ) : (
          // Change Entrance Options
          <View className="flex flex-col gap-2 rounded-xl bg-white px-5 py-4 shadow-sm">
            {/* Heading */}
            <Text className="text-lg color-[#64748b]">Change Entrance</Text>
            {/* EntranceButtons */}
            {/* Implement a FlatList */}
          </View>
        )}
      </View>
    </>
  );
};

export default EditRouteModal;
