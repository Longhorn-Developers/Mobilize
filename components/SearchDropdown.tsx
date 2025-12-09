import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TouchableWithoutFeedback,
} from "react-native";
import {
  ClockIcon,
  MapPinIcon,
} from "phosphor-react-native";
import colors from "~/types/colors";

interface Location {
  id: string;
  name: string;
  address?: string;
  type?: "building" | "classroom" | "entrance" | "recent";
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
  if (!visible) return null;

  // Mock data - we'll replace this with real data later
  const recentSearches: Location[] = [
    {
      id: "1",
      name: "Texas Union Building",
      address: "2100 Guadalupe St",
      type: "recent",
    },
    {
      id: "2",
      name: "PCL (Perry-Castañeda Library)",
      address: "101 E 21st St",
      type: "recent",
    },
  ];

  // Mock search results - filter by query
  const allLocations: Location[] = [
    {
      id: "3",
      name: "Texas Global",
      address: "2300 Red River St",
      type: "building",
    },
    {
      id: "4",
      name: "Texas Union Building",
      address: "2100 Guadalupe St",
      type: "building",
    },
    {
      id: "5",
      name: "Texas Ballroom",
      address: "2100 Guadalupe St",
      type: "building",
    },
    {
      id: "6",
      name: "GDC (Gates Dell Complex)",
      address: "2317 Speedway",
      type: "building",
    },
    {
      id: "7",
      name: "Gregory Gym",
      address: "2101 Speedway",
      type: "building",
    },
  ];

  const searchResults: Location[] = searchQuery.length > 0
    ? allLocations.filter((location) =>
        location.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const displayedLocations = searchQuery.length > 0 ? searchResults : recentSearches;

  const renderLocationItem = ({ item }: { item: Location }) => (
    <TouchableOpacity
      onPress={() => onSelectLocation(item)}
      className="flex-row items-center gap-3 border-b border-gray-100 px-5 py-3"
      activeOpacity={0.7}
    >
      {/* Icon */}
      <View className="h-8 w-8 items-center justify-center">
        {item.type === "recent" ? (
          <ClockIcon size={20} color={colors.ut.gray} />
        ) : (
          <MapPinIcon size={20} color={colors.ut.gray} />
        )}
      </View>

      {/* Location Info */}
      <View className="flex-1">
        <Text className="text-base font-medium text-gray-900">{item.name}</Text>
        {item.address && (
          <Text className="text-sm text-gray-500">{item.address}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <>
      {/* Transparent overlay to dismiss */}
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View className="absolute bottom-0 left-0 right-0 top-0 bg-black/20" />
      </TouchableWithoutFeedback>

      {/* Dropdown Content */}
      <View
        className="absolute left-4 right-4 z-10 rounded-2xl bg-white shadow-2xl"
        style={{ top: topOffset }}
      >
        {/* Section Header */}
        {displayedLocations.length > 0 && (
          <View className="border-b border-gray-100 px-5 py-2">
            <Text className="text-xs font-semibold uppercase text-gray-500">
              {searchQuery.length > 0 ? "Results" : "Recent"}
            </Text>
          </View>
        )}

        {/* Results List */}
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
                <Text className="text-center text-base text-gray-400">
                  No results found for "{searchQuery}"
                </Text>
              </View>
            ) : null
          }
        />
      </View>
    </>
  );
};