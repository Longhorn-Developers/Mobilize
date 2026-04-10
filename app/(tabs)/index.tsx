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
import POIBottomSheet from "~/components/POIBottomSheet";
import { Button } from "~/components/Button";
import ReportModal from "~/components/ReportModal";
import {
  usePOIs,
  useAvoidanceAreas,
  useConstructionAreas,
  useInsertAvoidanceArea,
} from "~/utils/api-hooks";
import useMapIcons from "~/utils/useMapIcons";

import { SearchBar } from "~/components/SearchBar";
import { SearchDropdown } from "~/components/SearchDropdown";
import {
  LocationDetailsBottomSheet,
  type LocationDetailsBottomSheetRef,
} from "~/components/LocationDetailsBottomSheet";
import { searchPlaces, getPlaceDetails, PlaceDetails } from "~/utils/googlePlaces";
import RoutePreviewBottomSheet from "~/components/RoutePreviewBottomSheet";

export default function Home() {
  // hooks
  const insets = useSafeAreaInsets();
  const mapIcons = useMapIcons();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const avoidanceAreaBottomSheetRef = useRef<BottomSheetModal>(null);
  const poiBottomSheetRef = useRef<BottomSheetModal>(null);
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const locationBottomSheetRef = useRef<LocationDetailsBottomSheetRef>(null);
  const routePreviewBottomSheetRef = useRef<BottomSheetModal>(null);

  // states
  const [isReportMode, setIsReportMode] = useState(false);
  const [aaPointsReport, setAAPointsReport] = useState<LatLng[]>([]);
  const [clickedPoint, setClickedPoint] = useState<LatLng | null>(null);
  const [reportStep, setReportStep] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(15);

  // Minimum zoom level to show POIs (higher = more zoomed in)
  const MIN_ZOOM_FOR_POIS = 16;
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mapRegion, setMapRegion] = useState({
    latitude: 30.282,
    longitude: -97.733,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  // query hooks
  const { data: avoidanceAreas } = useAvoidanceAreas();
  const { data: constructionAreas } = useConstructionAreas();
  const { data: POIs } = usePOIs();
  const { mutateAsync: insertAvoidanceArea } = useInsertAvoidanceArea();

  // const testGooglePlaces = async () => {
  //   console.log("Testing Google Places...");
  //   const results = await searchPlaces("Texas Global");
  //   console.log("Search results:", results);
    
  //   if (results.length > 0) {
  //     const details = await getPlaceDetails(results[0].place_id);
  //     console.log("Place details:", details);
  //   }
  // };

  // useEffect(() => {
  //   testGooglePlaces();
  // }, []);

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
      avoidanceAreaBottomSheetRef.current?.close();
      poiBottomSheetRef.current?.close();
    }
  };

  // Handle avoidance area click
  const handleAvoidanceAreaPress = (polygonId: string) => {
    if (isReportMode) return;
    avoidanceAreaBottomSheetRef.current?.present({ id: polygonId });
  };

  // Handle POI click
  const handlePOIPress = (poi: any) => {
    if (isReportMode) return;
    poiBottomSheetRef.current?.present({ poi });
    if (poi.poi_type[0] === 'C') return; // construction areas
    bottomSheetRef.current?.present({ id: poi.id });
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
      //Construction zones
      ...(constructionAreas || []).map((area) => ({
        id: String("C" + area.id),
        coordinates: area.points.map(
          (coord: [number, number]) => ({
            longitude: coord[1],
            latitude: coord[0],
          }),
        ),
        fillColor: "rgba(255, 153, 0, 0.4)",
        strokeColor: "rgba(255, 123, 0, 0.7)",
        strokeWidth: 0.1,
      })),
    ],
    [avoidanceAreas, aaPointsReport, constructionAreas]
  );

  const markers = useMemo(
    () => {
      if (POIs && !isReportMode) {
        console.log("Pois loaded.");
        // console.log(POIs);
      }
      
      const poiMarkers = !isReportMode && zoomLevel >= MIN_ZOOM_FOR_POIS
        ? (POIs || []).map((poi) => {
            const marker = {
              id: String(poi.id),
              coordinate: {
                longitude: poi.location_geojson.coordinates[0],
                latitude: poi.location_geojson.coordinates[1],
              } satisfies LatLng,
              icon: getMapIcon(poi.poi_type, poi.metadata) || undefined,
            };
            // 📝 ADDED CONSOLE LOGGING HERE
            // console.log(`POI Marker for ID ${marker.id}:`, marker);
            return marker;
          })
        : [];

      return [
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
        ...poiMarkers,
      ];
    },
    [POIs, aaPointsReport, mapIcons, getMapIcon, isReportMode, clickedPoint, zoomLevel],
  );

  const handleSelectLocation = async (location: {
    id: string;
    name: string;
    address?: string;
    place_id?: string;
  }) => {
    console.log("Selected location:", location);
    
    // Close search
    setIsSearchActive(false);
    setSearchQuery("");
    
    // Fetch full place details
    if (location.place_id) {
      // Real Data
      // const placeDetails = await getPlaceDetails(location.place_id);
      // Test Data
      const placeDetails: PlaceDetails = {"formatted_address": "2400 Nueces St Suite B, Austin, TX 78705, USA", "geometry": {"location": {"lat": 30.2883838, "lng": -97.7434334}}, "name": "Texas Global at The University of Texas at Austin", "opening_hours": {"open_now": false, "weekday_text": ["Monday: 8:00 AM – 5:00 PM", "Tuesday: 8:00 AM – 5:00 PM", "Wednesday: 8:00 AM – 5:00 PM", "Thursday: 8:00 AM – 5:00 PM", "Friday: 8:00 AM – 5:00 PM", "Saturday: Closed", "Sunday: Closed"]}, "photos": [{"height": 600, "photo_reference": "places/ChIJ5SpAob21RIYRT11gcy0lxGk/photos/AU_ZVEETycqzGQt78dQ9OKgsaZ5Of5mcNsKiLGPx5tyrdwiMV5rkqey5kt_UqV9_nyb3tpqCcGhewVolb3GPvIc57JF3ch2MGX_uWkULCJHslMdqvQv0Wfx20s0nyg_otTsBP1WBmHTTmOEjSkesELcomhx9HHAWNNlOyWvCnF-l5Hu4oUnKQQWgYN7p6PeDNhKUFMxrhvKB_h_QY_sJZ-_bX3XzoA9_w5cIMohgazlJhLsTOOJ9Q183tF_nl6me6VfDH3P3hTJz6VjtOj1t7mR3LwCib4mOE5BRR_N4gAWd9OEX3A", "width": 1110}], "place_id": "ChIJ5SpAob21RIYRT11gcy0lxGk", "rating": 5, "types": ["academic_department", "point_of_interest", "establishment"], "user_ratings_total": 5};
      
      if (placeDetails) {
        // TODO: Get user's current location to calculate distance
        // For now, using a placeholder
        //const distance = "2.4 Mi";
        
        // Open location details bottom sheet with real data
        locationBottomSheetRef.current?.present(placeDetails);
      }
    }
  };

  const handleSelectStart = (selectedLoc: {lat: number, lng: number}) => {
    setMapRegion({
      latitude: selectedLoc.lat,
      longitude: selectedLoc.lng,
      latitudeDelta: 0.001,
      longitudeDelta: 0.001,
    });

    poiBottomSheetRef.current?.close();
    routePreviewBottomSheetRef.current?.present({start: [0, 0], end: [selectedLoc.lat, selectedLoc.lng]});
  }

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

    {/* Search Bar - hide in report mode */}
    {!isReportMode && (
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
    )}

    {/* Search Dropdown - hide in report mode */}
    {!isReportMode && (
      <SearchDropdown
        visible={isSearchActive}
        searchQuery={searchQuery}
        onSelectLocation={handleSelectLocation}
        onDismiss={handleDismissSearch}
        topOffset={insets.top + 70}
      />
    )}

      {/* Avoidance Area Bottom Sheet */}
      <AvoidanceAreaBottomSheet ref={avoidanceAreaBottomSheetRef} />
      
      {/* POI Bottom Sheet */}
      <POIBottomSheet ref={poiBottomSheetRef} allPOIs={POIs ?? []} handleSelectStart={handleSelectStart} />

      {/* Route Preview */}
      <RoutePreviewBottomSheet ref={routePreviewBottomSheetRef} />

    {/* Location Details Bottom Sheet */}
    <LocationDetailsBottomSheet ref={locationBottomSheetRef} />

      <MapView
        style={{ flex: 1 }}
        onPress={handleMapPress}
        region={mapRegion}
        // TODO animate ref (i think noah already made something like this?)
        onRegionChangeComplete={(region) => {
          // Calculate zoom level from latitudeDelta
          const zoom = Math.round(Math.log(360 / region.latitudeDelta) / Math.LN2);
          setZoomLevel(zoom);
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
            onPress={() => {
              const poi = POIs?.find((p) => String(p.id) === marker.id);
              if (poi) {
                handlePOIPress(poi);
              }
            }}
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