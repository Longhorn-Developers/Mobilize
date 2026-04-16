import { ClockIcon, MapPinIcon } from "phosphor-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  View,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";

import colors from "~/types/colors";
import { searchBuildings } from "~/utils/buildingDatabase";
import { searchPlaces, PlaceAutocompletePrediction } from "~/utils/mapboxSearch";
import { useTheme } from "~/utils/ThemeContext";

interface Location {
  id: string;
  name: string;
  address?: string;
  type?: "building" | "classroom" | "entrance" | "recent";
  place_id?: string;
  source?: "local" | "remote";
}

interface SearchDropdownProps {
  visible: boolean;
  searchQuery: string;
  onSelectLocation: (location: Location) => void;
  onDismiss: () => void;
  topOffset: number;
}

export const SearchDropdown = ({
  visible,
  searchQuery,
  onSelectLocation,
  onDismiss,
  topOffset,
}: SearchDropdownProps) => {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === "dark";

  const [remoteResults, setRemoteResults] = useState<PlaceAutocompletePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const recentSearches: Location[] = [
    { id: "1", name: "Texas Union Building", address: "2100 Guadalupe St", type: "recent" },
    { id: "2", name: "PCL (Perry-Castañeda Library)", address: "101 E 21st St", type: "recent" },
  ];

  useEffect(() => {
    const fetchPlaces = async () => {
      if (searchQuery.length < 2) {
        setRemoteResults([]);
        return;
      }
      setIsLoading(true);
      const results = await searchPlaces(searchQuery);
      setRemoteResults(results);
      setIsLoading(false);
    };

    const timeoutId = setTimeout(fetchPlaces, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const campusResults: Location[] = searchBuildings(searchQuery).map((building) => ({
    id: `local_${building.Building_Abbr}`,
    name: `${building.Building_Abbr} - ${building.Description}`,
    address: building.Address_Full,
    type: "building" as const,
    place_id: `local_${building.Building_Abbr}`,
    source: "local" as const,
  }));

  const searchResults: Location[] = remoteResults.map((prediction) => ({
    id: prediction.place_id,
    name: prediction.structured_formatting.main_text,
    address: prediction.structured_formatting.secondary_text,
    type: "building" as const,
    place_id: prediction.place_id,
    source: "remote" as const,
  }));

  const displayedLocations = searchQuery.length > 0
    ? [...campusResults, ...searchResults.filter((result) =>
        !campusResults.some((campus) => campus.name === result.name && campus.address === result.address),
      )]
    : recentSearches;

  if (!visible) return null;

  const iconColor = isDark ? "#6B7280" : colors.ut.gray;
  const dividerColor = isDark ? "#3A3A3C" : "#F3F4F6";
  const dropdownBg = isDark ? "#1C1C1E" : "#FFFFFF";

  const renderLocationItem = ({ item }: { item: Location }) => (
    <TouchableOpacity
      onPress={() => onSelectLocation(item)}
      style={{ borderBottomColor: dividerColor, borderBottomWidth: 1 }}
      className="flex-row items-center gap-3 px-5 py-3"
      activeOpacity={0.7}
    >
      <View className="h-8 w-8 items-center justify-center">
        {item.type === "recent" ? (
          <ClockIcon size={20} color={iconColor} />
        ) : (
          <MapPinIcon size={20} color={iconColor} />
        )}
      </View>
      <View className="flex-1">
        <Text className={`text-base font-medium ${isDark ? "text-gray-100" : "text-gray-900"}`}>
          {item.name}
        </Text>
        {item.address && (
          <Text className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            {item.address}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View className="absolute bottom-0 left-0 right-0 top-0 bg-black/20" />
      </TouchableWithoutFeedback>

      <View
        className="absolute left-4 right-4 z-10 rounded-2xl shadow-2xl"
        style={{ top: topOffset, backgroundColor: dropdownBg }}
      >
        {displayedLocations.length > 0 && (
          <View
            style={{ borderBottomColor: dividerColor, borderBottomWidth: 1 }}
            className="px-5 py-2"
          >
            <Text className={`text-xs font-semibold uppercase ${isDark ? "text-gray-500" : "text-gray-500"}`}>
              {searchQuery.length > 0 ? "Results" : "Recent"}
            </Text>
          </View>
        )}

        {isLoading ? (
          <View className="items-center justify-center py-8">
            <ActivityIndicator size="small" color={colors.ut.burntorange} />
            <Text className={`mt-2 text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
              Searching...
            </Text>
          </View>
        ) : (
          <FlatList
            data={displayedLocations}
            renderItem={renderLocationItem}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={displayedLocations.length > 5}
            style={{ maxHeight: 300 }}
            ListEmptyComponent={
              searchQuery.length > 0 ? (
                <View className="items-center justify-center px-6 py-8">
                  <Text className={`text-center text-base ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                    {`No results found for "${searchQuery}"`}
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </View>
    </>
  );
};
