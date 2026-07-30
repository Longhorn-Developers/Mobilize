import { BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import {
  ArrowsDownUpIcon,
  ArrowLeftIcon,
  MapPinIcon,
  NavigationArrowIcon,
  PlusIcon,
  XIcon,
  ArrowRightIcon,
} from "phosphor-react-native";
import React, { ForwardedRef, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  deriveRouteTags,
  formatDistance,
  formatDuration,
  formatETA,
  formatStepDistance,
  getDirectionIcon,
} from "~/src/features/navigation/navigationUtils";
import { type RoutePreviewState, type RouteStop } from "~/src/features/navigation/useRoutePreview";
import { ROUTING_PROFILES, type ORSRoute, type RoutingProfile } from "~/utils/openRouteService";
import { searchBuildings, type BuildingProperties } from "~/utils/buildingDatabase";
import { getPlaceDetails, searchPlaces, type PlaceAutocompletePrediction } from "~/utils/googlePlaces";
import { useTheme } from "~/utils/ThemeContext";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

const PROFILE_ICONS: Partial<Record<RoutingProfile, ReturnType<typeof require>>> = {
  wheelchair: require("../../../assets/map_icons/wheelchair.png"),
  "foot-walking": require("../../../assets/map_icons/walk.png"),
};

type EditingField = "origin" | "destination" | "stop";

interface RoutePreviewSheetProps {
  ref: ForwardedRef<BottomSheetModal>;
  previewState: RoutePreviewState;
  onGo: () => void;
  onChangeProfile: (p: RoutingProfile) => void;
  onSwapOriginDest: () => void;
  onSetOrigin: (coords: [number, number], name: string) => void;
  onSetDestination: (coords: [number, number], name: string) => void;
  onAddStop: (coords: [number, number], name: string) => void;
  onRemoveStop: (index: number) => void;
  onToggleDirectionsList: () => void;
  onDismiss: () => void;
}

// ─── Search Modal ────────────────────────────────────────────────────────────

interface SearchModalProps {
  visible: boolean;
  isDark: boolean;
  onSelect: (coords: [number, number], name: string) => void;
  onClose: () => void;
}

type SearchResultItem =
  | { kind: "building"; key: string; building: BuildingProperties }
  | { kind: "place"; key: string; prediction: PlaceAutocompletePrediction };

function SearchModal({ visible, isDark, onSelect, onClose }: SearchModalProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [remoteResults, setRemoteResults] = useState<PlaceAutocompletePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [resolvingPlaceId, setResolvingPlaceId] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const requestIdRef = useRef(0);

  const trimmedQuery = query.trim();
  const localResults = trimmedQuery.length > 0 ? searchBuildings(trimmedQuery, 10) : [];

  useEffect(() => {
    if (!visible || trimmedQuery.length < 2) {
      setRemoteResults([]);
      setIsSearching(false);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    setIsSearching(true);

    const timeoutId = setTimeout(async () => {
      try {
        const [campusResults, globalResults] = await Promise.all([
          searchPlaces(trimmedQuery, { scope: "campus" }),
          searchPlaces(trimmedQuery, { scope: "global" }),
        ]);
        if (currentRequestId !== requestIdRef.current) return;

        const seenIds = new Set(campusResults.map((p) => p.place_id));
        setRemoteResults([
          ...campusResults,
          ...globalResults.filter((p) => !seenIds.has(p.place_id)),
        ]);
      } catch {
        if (currentRequestId === requestIdRef.current) setRemoteResults([]);
      } finally {
        if (currentRequestId === requestIdRef.current) setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [trimmedQuery, visible]);

  const results: SearchResultItem[] = [
    ...localResults.map((building) => ({
      kind: "building" as const,
      key: `building_${building.Building_Abbr}`,
      building,
    })),
    ...remoteResults
      .filter(
        (prediction) =>
          !localResults.some(
            (building) =>
              building.Description === prediction.structured_formatting.main_text,
          ),
      )
      .map((prediction) => ({
        kind: "place" as const,
        key: prediction.place_id,
        prediction,
      })),
  ];

  const bg = isDark ? "#1C1C1E" : "#FFFFFF";
  const inputBg = isDark ? "#2C2C2E" : "#F3F4F6";
  const textColor = isDark ? "#F9FAFB" : "#1A2024";
  const subColor = isDark ? "#9CA3AF" : "#64748B";
  const divider = isDark ? "#3A3A3C" : "#E5E7EB";

  const handleClose = useCallback(() => {
    setQuery("");
    setRemoteResults([]);
    onClose();
  }, [onClose]);

  const handleSelectBuilding = useCallback(
    (building: BuildingProperties) => {
      const coords: [number, number] = [building.centroid.lng, building.centroid.lat];
      onSelect(coords, building.Description);
      setQuery("");
      setRemoteResults([]);
    },
    [onSelect],
  );

  const handleSelectPlace = useCallback(
    async (prediction: PlaceAutocompletePrediction) => {
      setResolvingPlaceId(prediction.place_id);
      try {
        const details = await getPlaceDetails(
          prediction.place_id,
          prediction.structured_formatting.main_text,
        );
        if (!details) return;
        const coords: [number, number] = [
          details.geometry.location.lng,
          details.geometry.location.lat,
        ];
        onSelect(coords, details.name || prediction.structured_formatting.main_text);
        setQuery("");
        setRemoteResults([]);
      } finally {
        setResolvingPlaceId(null);
      }
    },
    [onSelect],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.searchModalContainer, { backgroundColor: bg, paddingTop: insets.top + 12 }]}>
        {/* Header row */}
        <View style={styles.searchHeader}>
          <TouchableOpacity onPress={handleClose} style={styles.searchBackBtn}>
            <ArrowLeftIcon size={22} color={textColor} weight="bold" />
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search anywhere…"
            placeholderTextColor={subColor}
            style={[styles.searchInput, { backgroundColor: inputBg, color: textColor }]}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} style={styles.searchClearBtn}>
              <XIcon size={18} color={subColor} weight="bold" />
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.divider, { backgroundColor: divider }]} />

        {results.length === 0 && trimmedQuery.length > 0 && !isSearching ? (
          <View style={styles.searchEmpty}>
            <Text style={[styles.searchEmptyText, { color: subColor }]}>No results found</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.key}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={
              isSearching ? (
                <View style={styles.searchLoadingRow}>
                  <ActivityIndicator size="small" color="#BF5700" />
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const isResolving =
                item.kind === "place" && resolvingPlaceId === item.prediction.place_id;
              const name =
                item.kind === "building" ? item.building.Description : item.prediction.structured_formatting.main_text;
              const address =
                item.kind === "building" ? item.building.Address_Full : item.prediction.structured_formatting.secondary_text;

              return (
                <TouchableOpacity
                  style={styles.searchResult}
                  onPress={() =>
                    item.kind === "building"
                      ? handleSelectBuilding(item.building)
                      : handleSelectPlace(item.prediction)
                  }
                  activeOpacity={0.7}
                  disabled={isResolving}
                >
                  {isResolving ? (
                    <ActivityIndicator size="small" color="#BF5700" style={{ marginTop: 2 }} />
                  ) : (
                    <MapPinIcon size={18} color="#BF5700" weight="bold" style={{ marginTop: 2 }} />
                  )}
                  <View style={styles.searchResultText}>
                    <Text style={[styles.searchResultName, { color: textColor }]} numberOfLines={1}>
                      {name}
                    </Text>
                    {!!address && (
                      <Text style={[styles.searchResultAddr, { color: subColor }]} numberOfLines={1}>
                        {address}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

// ─── Directions List ─────────────────────────────────────────────────────────

interface DirectionsListProps {
  route: ORSRoute;
  isDark: boolean;
  onBack: () => void;
}

function DirectionsList({ route, isDark, onBack }: DirectionsListProps) {
  const textColor = isDark ? "#F9FAFB" : "#1A2024";
  const subColor = isDark ? "#9CA3AF" : "#64748B";
  const divider = isDark ? "#3A3A3C" : "#E5E7EB";

  return (
    <>
      <TouchableOpacity style={styles.directionsBack} onPress={onBack} activeOpacity={0.7}>
        <ArrowLeftIcon size={20} color={textColor} weight="bold" />
        <Text style={[styles.directionsBackLabel, { color: textColor }]}>Route Overview</Text>
      </TouchableOpacity>

      <BottomSheetScrollView contentContainerStyle={styles.directionsListContent}>
        {route.steps.map((step, i) => (
          <View key={i}>
            <View style={styles.stepRow}>
              <View style={styles.stepIcon}>
                {getDirectionIcon(step, "#BF5700", 22)}
              </View>
              <Text style={[styles.stepInstruction, { color: textColor }]} numberOfLines={3}>
                {step.instruction}
              </Text>
              <Text style={[styles.stepDist, { color: subColor }]}>
                {formatStepDistance(step.distance)}
              </Text>
            </View>
            {i < route.steps.length - 1 && (
              <View style={[styles.stepDivider, { backgroundColor: divider }]} />
            )}
          </View>
        ))}
      </BottomSheetScrollView>
    </>
  );
}

// ─── Route Card ──────────────────────────────────────────────────────────────

interface RouteCardProps {
  route: ORSRoute | null;
  isLoading: boolean;
  error: string | null;
  profile: RoutingProfile;
  isDark: boolean;
  onPress: () => void;
  onGo: () => void;
}

function RouteCard({ route, isLoading, error, profile, isDark, onPress, onGo }: RouteCardProps) {
  const textColor = isDark ? "#F9FAFB" : "#1A2024";
  const subColor = isDark ? "#9CA3AF" : "#64748B";
  const cardBg = isDark ? "#2C2C2E" : "#F3F4F6";
  const chipBg = isDark ? "#3A3A3C" : "#E5E7EB";

  return (
    <Pressable
      style={[styles.routeCard, { backgroundColor: cardBg }]}
      onPress={route ? onPress : undefined}
    >
      {isLoading ? (
        <View style={styles.routeCardCenter}>
          <ActivityIndicator color="#BF5700" size="small" />
          <Text style={[styles.routeCardLoading, { color: subColor }]}>Calculating route…</Text>
        </View>
      ) : error ? (
        <View style={styles.routeCardCenter}>
          <Text style={[styles.routeCardError, { color: "#D10000" }]}>{error}</Text>
        </View>
      ) : route ? (
        <View style={styles.routeCardContent}>
          <View style={styles.routeCardMain}>
            {/* Time, ETA, Distance */}
            <View style={styles.routeCardStats}>
              <Text style={[styles.routeCardTime, { color: textColor }]}>
                {formatDuration(route.totalDurationSec)}
              </Text>
              <Text style={[styles.routeCardETA, { color: subColor }]}>
                ETA {formatETA(route.totalDurationSec)}
              </Text>
              <Text style={[styles.routeCardDist, { color: subColor }]}>
                {formatDistance(route.totalDistanceMi)}
              </Text>
            </View>
            {/* Tags */}
            <View style={styles.routeCardTags}>
              {deriveRouteTags(profile, route).map((tag) => (
                <View key={tag} style={[styles.routeChip, { backgroundColor: chipBg }]}>
                  <Text style={[styles.routeChipText, { color: subColor }]}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
          {/* GO button */}
          <TouchableOpacity
            style={styles.goButton}
            onPress={(e) => { e.stopPropagation(); onGo(); }}
            activeOpacity={0.8}
          >
            <Text style={styles.goButtonText}>GO</Text>
            <ArrowRightIcon size={16} color="#FFFFFF" weight="bold" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.routeCardCenter}>
          <Text style={[styles.routeCardLoading, { color: subColor }]}>No route data</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Main Sheet ──────────────────────────────────────────────────────────────

const RoutePreviewSheet = React.memo(
  ({
    ref,
    previewState,
    onGo,
    onChangeProfile,
    onSwapOriginDest,
    onSetOrigin,
    onSetDestination,
    onAddStop,
    onRemoveStop,
    onToggleDirectionsList,
    onDismiss,
  }: RoutePreviewSheetProps) => {
    const { colorScheme } = useTheme();
    const isDark = colorScheme === "dark";
    const bottomTabBarHeight = useBottomTabBarHeight();

    const [editingField, setEditingField] = useState<EditingField | null>(null);

    const bg = isDark ? "#1C1C1E" : "#FFFFFF";
    const textColor = isDark ? "#F9FAFB" : "#1A2024";
    const subColor = isDark ? "#9CA3AF" : "#64748B";
    const divider = isDark ? "#3A3A3C" : "#E5E7EB";
    const rowBg = isDark ? "#2C2C2E" : "#F9FAFB";
    const borderColor = isDark ? "#3A3A3C" : "#E5E7EB";

    const handleSearchSelect = useCallback(
      (coords: [number, number], name: string) => {
        if (editingField === "origin") onSetOrigin(coords, name);
        else if (editingField === "destination") onSetDestination(coords, name);
        else if (editingField === "stop") onAddStop(coords, name);
        setEditingField(null);
      },
      [editingField, onSetOrigin, onSetDestination, onAddStop],
    );

    const {
      originName,
      destinationName,
      profile,
      stops,
      route,
      isLoading,
      error,
      showDirectionsList,
    } = previewState;

    return (
      <>
        <BottomSheetModal
          ref={ref as React.RefObject<BottomSheetModal>}
          snapPoints={["42%", "95%"]}
          enableDynamicSizing={false}
          bottomInset={bottomTabBarHeight}
          enableContentPanningGesture={false}
          stackBehavior="replace"
          onDismiss={onDismiss}
          backgroundStyle={{ borderRadius: 32, backgroundColor: bg }}
          handleIndicatorStyle={{
            backgroundColor: isDark ? "#52525B" : "#D1D5DB",
            width: 80,
          }}
        >
          {() => (
            <BottomSheetScrollView
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Transport mode tabs */}
              <View style={styles.profileRow}>
                {ROUTING_PROFILES.map((p) => {
                  const active = profile === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => onChangeProfile(p.id)}
                      style={[
                        styles.profileTab,
                        {
                          borderColor: active ? "#BF5700" : borderColor,
                          backgroundColor: active ? "#BF570018" : rowBg,
                        },
                      ]}
                    >
                      {!!PROFILE_ICONS[p.id] && (
                        <Image
                          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                          source={PROFILE_ICONS[p.id]!}
                          style={[styles.profileIcon, { tintColor: active ? "#BF5700" : subColor }]}
                        />
                      )}
                      <Text
                        style={[
                          styles.profileLabel,
                          { color: active ? "#BF5700" : subColor },
                        ]}
                      >
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.divider, { backgroundColor: divider }]} />

              {/* Location rows */}
              <View style={styles.locationsBlock}>
                {/* Origin */}
                <View style={styles.locationRow}>
                  <NavigationArrowIcon size={18} color="#BF5700" weight="fill" />
                  <TouchableOpacity
                    style={styles.locationLabel}
                    onPress={() => setEditingField("origin")}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.locationText, { color: textColor }]} numberOfLines={1}>
                      {originName}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onSwapOriginDest}
                    style={styles.swapBtn}
                    activeOpacity={0.7}
                  >
                    <ArrowsDownUpIcon size={20} color={subColor} weight="bold" />
                  </TouchableOpacity>
                </View>

                <View style={[styles.locationDivider, { backgroundColor: divider }]} />

                {/* Destination */}
                <View style={styles.locationRow}>
                  <MapPinIcon size={18} color="#1A7CD4" weight="fill" />
                  <TouchableOpacity
                    style={styles.locationLabel}
                    onPress={() => setEditingField("destination")}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.locationText, { color: textColor }]} numberOfLines={1}>
                      {destinationName || "Choose destination"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Additional stops */}
                {stops.map((stop: RouteStop, i: number) => (
                  <View key={i}>
                    <View style={[styles.locationDivider, { backgroundColor: divider }]} />
                    <View style={styles.locationRow}>
                      <MapPinIcon size={18} color={subColor} weight="fill" />
                      <Text
                        style={[styles.locationText, { color: textColor, flex: 1, marginLeft: 10 }]}
                        numberOfLines={1}
                      >
                        {stop.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() => onRemoveStop(i)}
                        style={styles.swapBtn}
                        activeOpacity={0.7}
                      >
                        <XIcon size={18} color={subColor} weight="bold" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              {/* Add Stop */}
              {stops.length === 0 && (
                <TouchableOpacity
                  style={styles.addStopBtn}
                  onPress={() => setEditingField("stop")}
                  activeOpacity={0.7}
                >
                  <PlusIcon size={16} color="#BF5700" weight="bold" />
                  <Text style={styles.addStopText}>Add Stop</Text>
                </TouchableOpacity>
              )}

              <View style={[styles.divider, { backgroundColor: divider }]} />

              {/* Route card or directions list */}
              {showDirectionsList && route ? (
                <DirectionsList
                  route={route}
                  isDark={isDark}
                  onBack={onToggleDirectionsList}
                />
              ) : (
                <RouteCard
                  route={route}
                  isLoading={isLoading}
                  error={error}
                  profile={profile}
                  isDark={isDark}
                  onPress={onToggleDirectionsList}
                  onGo={onGo}
                />
              )}
            </BottomSheetScrollView>
          )}
        </BottomSheetModal>

        {/* Search modal for editing origin / destination / stop */}
        <SearchModal
          visible={editingField !== null}
          isDark={isDark}
          onSelect={handleSearchSelect}
          onClose={() => setEditingField(null)}
        />
      </>
    );
  },
);

RoutePreviewSheet.displayName = "RoutePreviewSheet";

export default RoutePreviewSheet;

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheetContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 0,
  },

  // Profile tabs
  profileRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 12,
  },
  profileTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  profileIcon: { width: 18, height: 18 },
  profileLabel: { fontFamily: "Inter", fontSize: 12, fontWeight: "600" },

  // Dividers
  divider: { height: 1, width: "100%", marginVertical: 4 },
  locationDivider: { height: 1, marginLeft: 28, marginRight: 0 },

  // Location rows
  locationsBlock: {
    paddingVertical: 8,
    gap: 0,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 10,
  },
  locationLabel: { flex: 1 },
  locationText: {
    fontFamily: "Inter",
    fontSize: 15,
    fontWeight: "500",
  },
  swapBtn: { padding: 4 },

  // Add stop
  addStopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingLeft: 4,
  },
  addStopText: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "600",
    color: "#BF5700",
  },

  // Route card
  routeCard: {
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    marginBottom: 8,
    minHeight: 80,
  },
  routeCardCenter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
  },
  routeCardContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  routeCardMain: { flex: 1, gap: 8 },
  routeCardStats: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    flexWrap: "wrap",
  },
  routeCardTime: {
    fontFamily: "Roboto Flex",
    fontSize: 28,
    fontWeight: "700",
  },
  routeCardETA: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "500",
  },
  routeCardDist: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "500",
  },
  routeCardTags: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  routeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  routeChipText: {
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "600",
  },
  routeCardLoading: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "500",
  },
  routeCardError: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },

  // GO button
  goButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#BF5700",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
  },
  goButtonText: {
    fontFamily: "Roboto Flex",
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // Directions list
  directionsBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingBottom: 4,
  },
  directionsBackLabel: {
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: "600",
  },
  directionsListContent: {
    paddingBottom: 24,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(191,87,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepInstruction: {
    flex: 1,
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  stepDist: {
    fontFamily: "Inter",
    fontSize: 13,
    fontWeight: "500",
    minWidth: 44,
    textAlign: "right",
  },
  stepDivider: {
    height: 1,
    marginLeft: 48,
  },

  // Search modal
  searchModalContainer: {
    flex: 1,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  searchBackBtn: { padding: 6 },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontFamily: "Inter",
    fontSize: 15,
  },
  searchClearBtn: { padding: 6 },
  searchEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 48,
  },
  searchEmptyText: {
    fontFamily: "Inter",
    fontSize: 15,
    fontWeight: "500",
  },
  searchLoadingRow: {
    paddingVertical: 16,
    alignItems: "center",
  },
  searchResult: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchResultText: { flex: 1, gap: 2 },
  searchResultName: {
    fontFamily: "Inter",
    fontSize: 15,
    fontWeight: "500",
  },
  searchResultAddr: {
    fontFamily: "Inter",
    fontSize: 13,
    fontWeight: "400",
  },
});
