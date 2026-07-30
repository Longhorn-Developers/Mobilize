import AsyncStorage from "@react-native-async-storage/async-storage";
import { ClockIcon, MapPinIcon, XIcon } from "phosphor-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import colors from "~/types/colors";
import { searchBuildings } from "~/utils/buildingDatabase";
import { searchPlaces, PlaceAutocompletePrediction } from "~/utils/googlePlaces";
import { useTheme } from "~/utils/ThemeContext";

const RECENT_KEY = "recent_searches_v1";
const MAX_RECENT = 5;

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
  const [recentSearches, setRecentSearches] = useState<Location[]>([]);
  const requestIdRef = useRef(0);

  // Load recent searches from storage once
  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((json) => {
      if (!json) return;
      try { setRecentSearches(JSON.parse(json)); } catch {}
    });
  }, []);

  // Save a location to recent searches
  const saveRecent = useCallback((location: Location) => {
    setRecentSearches((prev) => {
      const entry: Location = { ...location, type: "recent" };
      const updated = [entry, ...prev.filter((r) => r.id !== location.id)].slice(0, MAX_RECENT);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleSelectLocation = useCallback(
    (location: Location) => {
      saveRecent(location);
      onSelectLocation(location);
    },
    [saveRecent, onSelectLocation],
  );

  useEffect(() => {
    if (!visible) {
      setRemoteResults([]);
      setIsLoading(false);
      return;
    }

    const fetchPlaces = async () => {
      if (searchQuery.trim().length < 2) {
        setRemoteResults([]);
        setIsLoading(false);
        return;
      }

      const currentRequestId = ++requestIdRef.current;
      setIsLoading(true);

      try {
        // Run campus + global searches concurrently so off-campus places always appear
        const [campusResults, globalResults] = await Promise.all([
          searchPlaces(searchQuery, { scope: "campus" }),
          searchPlaces(searchQuery, { scope: "global" }),
        ]);

        if (currentRequestId === requestIdRef.current) {
          // Campus results first, then de-duplicated global results
          const seenIds = new Set(campusResults.map((p) => p.place_id));
          setRemoteResults([
            ...campusResults,
            ...globalResults.filter((p) => !seenIds.has(p.place_id)),
          ]);
        }
      } catch {
        if (currentRequestId === requestIdRef.current) setRemoteResults([]);
      } finally {
        if (currentRequestId === requestIdRef.current) setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchPlaces, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, visible]);

  const campusResults: Location[] = searchBuildings(searchQuery).map((building) => ({
    id: `local_${building.Building_Abbr}`,
    name: `${building.Building_Abbr} - ${building.Description}`,
    address: building.Address_Full,
    type: "building",
    place_id: `local_${building.Building_Abbr}`,
    source: "local",
  }));

  const searchResults: Location[] = remoteResults.map((prediction) => ({
    id: prediction.place_id,
    name: prediction.structured_formatting.main_text,
    address: prediction.structured_formatting.secondary_text,
    type: "building",
    place_id: prediction.place_id,
    source: "remote",
  }));

  const displayedLocations =
    searchQuery.trim().length > 0
      ? [
          ...campusResults,
          ...searchResults.filter(
            (result) =>
              !campusResults.some(
                (campus) => campus.name === result.name && campus.address === result.address,
              ),
          ),
        ]
      : recentSearches; // real AsyncStorage-backed recents

  if (!visible) return null;

  const iconColor = isDark ? "#6B7280" : colors.ut.gray;
  const dividerColor = isDark ? "#3A3A3C" : "#F3F4F6";
  const dropdownBg = isDark ? "#1C1C1E" : "#FFFFFF";

  const renderLocationItem = ({ item }: { item: Location }) => (
    <TouchableOpacity
      onPress={() => handleSelectLocation(item)}
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
        {item.address ? (
          <Text className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
            {item.address}
          </Text>
        ) : null}
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
        {displayedLocations.length > 0 ? (
          <View
            style={{ borderBottomColor: dividerColor, borderBottomWidth: 1 }}
            className="flex-row items-center justify-between px-5 py-2"
          >
            <Text
              className={`text-xs font-semibold uppercase ${
                isDark ? "text-gray-500" : "text-gray-500"
              }`}
            >
              {searchQuery.trim().length > 0 ? "Results" : "Recent"}
            </Text>
            <TouchableOpacity onPress={onDismiss} hitSlop={8}>
              <XIcon size={16} color={iconColor} />
            </TouchableOpacity>
          </View>
        ) : null}

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
              searchQuery.trim().length > 0 ? (
                <View className="items-center justify-center px-6 py-8">
                  <Text
                    className={`text-center text-base ${isDark ? "text-gray-500" : "text-gray-400"}`}
                  >
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
