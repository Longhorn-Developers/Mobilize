import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as turf from "@turf/turf";
import { Stack } from "expo-router";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { View } from "react-native";
import MapView, { Polygon, Marker, LatLng } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import AvoidanceAreaBottomSheet from "~/components/AvoidanceAreaBottomSheet";
import { Button } from "~/components/Button";
import ReportModal from "~/components/ReportModal";
import {
  usePOIs,
  useAvoidanceAreas,
  useInsertAvoidanceArea,
} from "~/utils/api-hooks";
import useMapIcons from "~/utils/useMapIcons";

import { SearchBar } from "~/components/SearchBar";
import { SearchDropdown } from "~/components/SearchDropdown";
import { LocationDetailsBottomSheet } from "~/components/LocationDetailsBottomSheet";
import { searchPlaces, getPlaceDetails } from "~/utils/googlePlaces";

export default function Home() {
  // hooks
  const insets = useSafeAreaInsets();
  const mapIcons = useMapIcons();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const locationBottomSheetRef = useRef<BottomSheetModal>(null);

  // states
  const [isReportMode, setIsReportMode] = useState(false);
  const [aaPointsReport, setAAPointsReport] = useState<LatLng[]>([]);
  const [clickedPoint, setClickedPoint] = useState<LatLng | null>(null);
  const [reportStep, setReportStep] = useState(0);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // query hooks
  const { data: avoidanceAreas } = useAvoidanceAreas();
  const { data: POIs } = usePOIs();
  const { mutateAsync: insertAvoidanceArea } = useInsertAvoidanceArea();

  const testGooglePlaces = async () => {
    console.log("Testing Google Places...");
    const results = await searchPlaces("Texas Global");
    console.log("Search results:", results);
    
    if (results.length > 0) {
      const details = await getPlaceDetails(results[0].place_id);
      console.log("Place details:", details);
    }
  };

  useEffect(() => {
    testGooglePlaces();
  }, []);

  const getMapIcon = useCallback(
    (poiType: any, metadata: any) => {
      switch (poiType) {
        case "accessible_entrance":
          return metadata.auto_opene ? mapIcons.autoDoor : mapIcons.manualDoor;
        default:
          return undefined;
      }
    },
    [mapIcons],
  );

  // Checks if resulting polygon formed by aaPointsReport + points is valid (no kinks)
  const isPointValid = (point: LatLng) => {
    if (aaPointsReport.length < 3) return true; // Need at least 3 points to form a polygon

    const polygon = turf.polygon([
      [
        ...aaPointsReport.map((p) => [p.longitude, p.latitude]),
        [point.longitude, point.latitude],
        [aaPointsReport[0].longitude, aaPointsReport[0].latitude],
      ],
    ]);
    const kinks = turf.kinks(polygon);

    // No kinks means the polygon is valid
    return kinks.features.length === 0;
  };

  const handleMapPress = (event: any) => {
    const coordinate = event.nativeEvent.coordinate;
    if (isReportMode) {
      if (reportStep !== 0) return;

      if (isPointValid(coordinate)) {
        setClickedPoint(coordinate);
        // Add pressed coordinates to marked points
        setAAPointsReport((prev) => [...prev, coordinate]);
      } else {
        Toast.show({
          type: "error",
          text2: "Invalid point! Please select a different point.",
          position: "bottom",
          bottomOffset: bottomTabBarHeight + 50,
        });
      }
    } else {
      bottomSheetRef.current?.close();
    }
  };

  // Handle avoidance area click
  const handleAvoidanceAreaPress = (polygonId: string) => {
    if (isReportMode) return;
    bottomSheetRef.current?.present({ id: polygonId });
  };

  const polygons = useMemo(
    () => [
      // Avoidance areas from the database
      ...(avoidanceAreas || []).map((area) => ({
        id: String(area.id),
        coordinates: area.boundary_geojson.coordinates[0].map(
          (coord: [number, number]) => ({
            longitude: coord[0],
            latitude: coord[1],
          }),
        ),
        fillColor: "rgba(255, 0, 0, 0.25)",
        strokeColor: "rgba(255, 0, 0, 0.5)",
        strokeWidth: 0.1,
      })),
      // User selected aaPoints to report
      ...(aaPointsReport.length > 0
        ? [
            {
              id: "report-polygon",
              coordinates: aaPointsReport,
              fillColor: "rgba(255, 0, 0, 0.25)",
              strokeColor: "red",
              strokeWidth: 2,
            },
          ]
        : []),
    ],
    [avoidanceAreas, aaPointsReport],
  );

  const markers = useMemo(
    () => [
      // User selected aaPoints to report
      ...aaPointsReport.map((point, index) => ({
        id: `report-point-${index}`,
        coordinate: point,
        icon: mapIcons.point || undefined,
      })),
      // Clicked point
      ...(clickedPoint
        ? [
            {
              id: "clicked-point",
              coordinate: clickedPoint,
              icon: mapIcons.crosshair || undefined,
            },
          ]
        : []),
      // POIs only show if not in report mode
      ...(!isReportMode
        ? (POIs || []).map((poi) => ({
            id: String(poi.id),
            coordinate: {
              longitude: poi.location_geojson.coordinates[0],
              latitude: poi.location_geojson.coordinates[1],
            } satisfies LatLng,
            icon: getMapIcon(poi.poi_type, poi.metadata) || undefined,
          }))
        : []),
    ],
    [POIs, aaPointsReport, mapIcons, getMapIcon, isReportMode, clickedPoint],
  );

  const handleSelectLocation = (location: {
    id: string;
    name: string;
    address?: string;
  }) => {
    console.log("Selected location:", location);
    
    // Close search
    setIsSearchActive(false);
    setSearchQuery("");
    
    // Open location details bottom sheet
    locationBottomSheetRef.current?.present();
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (!isSearchActive && text.length > 0) {
      setIsSearchActive(true);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  const handleDismissSearch = () => {
    setIsSearchActive(false);
    setSearchQuery("");
  };

  return (
    <>
      <Stack.Screen options={{ title: "Home", headerShown: false }} />

      {/* Search Bar */}
      <SearchBar 
        onPress={() => setIsSearchActive(true)}
        onChangeText={handleSearchChange}
        onClear={handleClearSearch}
        value={searchQuery}
        editable={isSearchActive}
        isActive={isSearchActive}
        className="absolute left-4 right-4 z-20"
        style={{ top: insets.top + 10 }}
      />

      {/* Search Dropdown */}
      <SearchDropdown
        visible={isSearchActive}
        searchQuery={searchQuery}
        onSelectLocation={handleSelectLocation}
        onDismiss={handleDismissSearch}
        topOffset={insets.top + 70}
      />

      {/* Avoidance Area Bottom Sheet */}
      <AvoidanceAreaBottomSheet ref={bottomSheetRef} />

      {/* Location Details Bottom Sheet */}
      <LocationDetailsBottomSheet ref={locationBottomSheetRef} />

      <MapView
        style={{ flex: 1 }}
        onPress={handleMapPress}
        region={{
          latitude: 30.282,
          longitude: -97.733,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {/* Render polygons */}
        {polygons.map((polygon, index) => (
          <Polygon
            key={polygon.id || `polygon-${index}`}
            coordinates={polygon.coordinates}
            fillColor={polygon.fillColor}
            strokeColor={polygon.strokeColor}
            strokeWidth={polygon.strokeWidth}
            tappable={true}
            onPress={() => {
              if (polygon.id && polygon.id !== "report-polygon") {
                handleAvoidanceAreaPress(polygon.id);
              }
            }}
          />
        ))}

        {/* Render markers */}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={marker.coordinate}
            image={marker.icon}
            anchor={{ x: 0.5, y: 0.5 }}
          />
        ))}
      </MapView>

      {isReportMode ? (
        <>
          {/* Report mode overlay tint */}
          <View className="pointer-events-none absolute bottom-0 left-0 right-0 top-0 bg-ut-blue/15" />
          {/* Report Mode Dialog */}
          <ReportModal
            className={`absolute left-10 right-10`}
            style={{
              top: insets.top + 25,
            }}
            aaPoints={aaPointsReport}
            currentStep={reportStep}
            setAAPoints={(points) => setAAPointsReport(points)}
            setCurrentStep={(index) => setReportStep(index)}
            onSubmit={async (data) => {
              const aaPoints = [...data.aaPoints, data.aaPoints[0]];

              await insertAvoidanceArea({
                user_id: 1, // TODO: REPLACE Temporary user ID
                name: data.description,
                boundary_geojson: {
                  type: "Polygon",
                  coordinates: [
                    aaPoints.map((point) => [
                      point.longitude || 0,
                      point.latitude || 0,
                    ]),
                  ],
                },
              });
            }}
            onExit={() => {
              setClickedPoint(null);
              setIsReportMode(false);
            }}
          />
        </>
      ) : (
        // Bottom right button to enter report mode
        <Button
          className="absolute bottom-4 right-4"
          title={"Report"}
          onPress={() => setIsReportMode(true)}
        />
      )}
    </>
  );
}