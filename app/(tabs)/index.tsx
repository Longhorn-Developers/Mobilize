import { BottomSheetModal } from "@gorhom/bottom-sheet";
import * as turf from "@turf/turf";
import { Stack } from "expo-router";
<<<<<<< HEAD
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { View } from "react-native";
import MapView, { Polygon, Marker, LatLng, Polyline } from "react-native-maps";
=======
import { useCallback, useMemo, useRef, useState } from "react";
import { View, Image } from "react-native";
import MapView, { Polygon, Marker, LatLng } from "react-native-maps";
>>>>>>> 30e290a2b3e74d12e0d359073e6b74da796c8d6d
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
  getRoute
} from "~/utils/api-hooks";
import useMapIcons from "~/utils/useMapIcons";

<<<<<<< HEAD
import { SearchBar } from "~/components/SearchBar";
import { SearchDropdown } from "~/components/SearchDropdown";
import {
  LocationDetailsBottomSheet,
  type LocationDetailsBottomSheetRef,
} from "~/components/LocationDetailsBottomSheet";
import { searchPlaces, getPlaceDetails } from "~/utils/googlePlaces";
import decode from "~/utils/decode_polyline";
=======
const BASE_ICON_SIZE = 16;
const BASE_ZOOM = 16;
const MIN_ZOOM_FOR_POIS = 14;
const ICON_SCALE = 16;
const MAX_ICON_SIZE = 50;

const CLUSTER_RADIUS = 10;

function getPOISubtype(poi: any): string {
  switch (poi.poi_type) {
    case "accessible_entrance":
      return `accessible_entrance__${poi.metadata?.auto_opene ? "auto" : "manual"}`;
    default:
      return poi.poi_type;
  }
}

function clusterPOIs(pois: any[]): any[] {
  const visited = new Set<number>();
  const clusters: any[] = [];

  for (let i = 0; i < pois.length; i++) {
    if (visited.has(i)) continue;

    const current = pois[i];
    const currentSubtype = getPOISubtype(current);
    const group = [current];
    visited.add(i);

    for (let j = i + 1; j < pois.length; j++) {
      if (visited.has(j)) continue;

      const candidate = pois[j];
      if (getPOISubtype(candidate) !== currentSubtype) continue;

      const pointA = turf.point([
        current.location_geojson.coordinates[0],
        current.location_geojson.coordinates[1],
      ]);
      const pointB = turf.point([
        candidate.location_geojson.coordinates[0],
        candidate.location_geojson.coordinates[1],
      ]);
      const distance = turf.distance(pointA, pointB, { units: "meters" });

      if (distance <= CLUSTER_RADIUS) {
        group.push(candidate);
        visited.add(j);
      }
    }

    if (group.length === 1) {
      clusters.push(current);
    } else {
      const multiPoint = turf.multiPoint(
        group.map((p) => [
          p.location_geojson.coordinates[0],
          p.location_geojson.coordinates[1],
        ]),
      );
      const centroid = turf.centroid(multiPoint);
      clusters.push({
        ...current,
        location_geojson: {
          ...current.location_geojson,
          coordinates: centroid.geometry.coordinates,
        },
        clusteredPOIs: group,
      });
    }
  }

  return clusters;
}
>>>>>>> 30e290a2b3e74d12e0d359073e6b74da796c8d6d

export default function Home() {
  // hooks
  const insets = useSafeAreaInsets();
  const mapIcons = useMapIcons();
<<<<<<< HEAD
  const bottomTabBarHeight = useBottomTabBarHeight();
  const avoidanceAreaBottomSheetRef = useRef<BottomSheetModal>(null);
  const poiBottomSheetRef = useRef<BottomSheetModal>(null);
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const locationBottomSheetRef = useRef<LocationDetailsBottomSheetRef>(null);
=======
  const bottomTabBarHeight = 50;
  const avoidanceAreaBottomSheetRef = useRef<BottomSheetModal>(null);
  const poiBottomSheetRef = useRef<BottomSheetModal>(null);
>>>>>>> 30e290a2b3e74d12e0d359073e6b74da796c8d6d

  // states
  const [isReportMode, setIsReportMode] = useState(false);
  const [aaPointsReport, setAAPointsReport] = useState<LatLng[]>([]);
  const [clickedPoint, setClickedPoint] = useState<LatLng | null>(null);
  const [reportStep, setReportStep] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(15);
<<<<<<< HEAD
  const [Route, setRoute] = useState<LatLng[] | null>(null);

  // Minimum zoom level to show POIs (higher = more zoomed in)
  const MIN_ZOOM_FOR_POIS = 16;
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
=======

  const markerSize = useMemo(() => {
    const scale = Math.pow(2, zoomLevel - BASE_ZOOM);
    return Math.min(Math.max(BASE_ICON_SIZE * scale, ICON_SCALE), MAX_ICON_SIZE);
  }, [zoomLevel]);
>>>>>>> 30e290a2b3e74d12e0d359073e6b74da796c8d6d

  // query hooks
  const { data: avoidanceAreas } = useAvoidanceAreas();
  const { data: constructionAreas } = useConstructionAreas();
  const { data: POIs } = usePOIs();
  const { mutateAsync: insertAvoidanceArea } = useInsertAvoidanceArea();
  // getRoute([[-97.733785,30.282635],[-97.733731,30.285145]], [[[-97.734269,30.284691],[-97.733454,30.284654],[-97.733669,30.283366],[-97.734708,30.283932],[-97.734269,30.284691]]]);

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


  const clusteredPOIs = useMemo(() => clusterPOIs(POIs || []), [POIs]);

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
    if (polygonId[0] == 'C') return; // construction areas
    if (isReportMode) return;
    avoidanceAreaBottomSheetRef.current?.present({ id: polygonId });
  };

  // Handle POI click
  const handlePOIPress = (poi: any) => {
    if (isReportMode) return;
<<<<<<< HEAD
    poiBottomSheetRef.current?.present({ poi });
=======
    poiBottomSheetRef.current?.present({ poi, clusteredPOIs: poi.clusteredPOIs ?? [poi] });
>>>>>>> 30e290a2b3e74d12e0d359073e6b74da796c8d6d
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
<<<<<<< HEAD
      if (POIs && !isReportMode) {
        // console.log("Pois");
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
=======
      const poiMarkers = !isReportMode && zoomLevel >= MIN_ZOOM_FOR_POIS
        ? clusteredPOIs.map((poi) => ({
            id: String(poi.id),
            coordinate: {
              longitude: poi.location_geojson.coordinates[0],
              latitude: poi.location_geojson.coordinates[1],
            } satisfies LatLng,
            icon: getMapIcon(poi.poi_type, poi.metadata) || undefined,
            isPOI: true,
            poiData: poi,
          }))
        : [];

      return [
>>>>>>> 30e290a2b3e74d12e0d359073e6b74da796c8d6d
        ...aaPointsReport.map((point, index) => ({
          id: `report-point-${index}`,
          coordinate: point,
          icon: mapIcons.point || undefined,
<<<<<<< HEAD
=======
          isPOI: false,
          poiData: null,
>>>>>>> 30e290a2b3e74d12e0d359073e6b74da796c8d6d
        })),
        // Clicked point
        ...(clickedPoint
          ? [
              {
                id: "clicked-point",
                coordinate: clickedPoint,
                icon: mapIcons.crosshair || undefined,
<<<<<<< HEAD
=======
                isPOI: false,
                poiData: null,
>>>>>>> 30e290a2b3e74d12e0d359073e6b74da796c8d6d
              },
            ]
          : []),
        // POIs only show if not in report mode
        ...poiMarkers,
      ];
    },
<<<<<<< HEAD
    [POIs, aaPointsReport, mapIcons, getMapIcon, isReportMode, clickedPoint, zoomLevel],
=======
    [clusteredPOIs, aaPointsReport, mapIcons, getMapIcon, isReportMode, clickedPoint, zoomLevel],
>>>>>>> 30e290a2b3e74d12e0d359073e6b74da796c8d6d
  );


  const getDirections = (target: any[]) => {
    const UT_TOWER = [-97.73942, 30.28614];
    let res = getRoute([UT_TOWER, target.slice(0, 2)], 
      polygons.map((poly) => poly.coordinates.map((coord: any) => [coord.longitude, coord.latitude]))
    )

    // console.log(decode({value: res.routes.geometry}));
    res.then((result) => {
      // console.log(decode(result.routes[0].geometry));
      setRoute(decode(result.routes[0].geometry).map(
        (coord) => ({
          latitude: coord[1],
          longitude: coord[0]
        })
      ));
    });
    // console.log(target.slice(0, 2));
    // console.log(polygons.map((poly) => poly.coordinates.map((coord: any) => [coord.longitude, coord.latitude])))

    // console.log(res);
  }


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
      const placeDetails = await getPlaceDetails(location.place_id);
      
      if (placeDetails) {
        // TODO: Get user's current location to calculate distance
        // For now, using a placeholder
        //const distance = "2.4 Mi";
        
        // Open location details bottom sheet with real data
        locationBottomSheetRef.current?.present(placeDetails);
      }
    }
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
<<<<<<< HEAD
      <POIBottomSheet ref={poiBottomSheetRef} allPOIs={POIs ?? []} getDirections={getDirections} />

      {/* Routing Mode Overlay */}
      {/* </> */}

    {/* Location Details Bottom Sheet */}
    <LocationDetailsBottomSheet ref={locationBottomSheetRef} />
=======
      <POIBottomSheet ref={poiBottomSheetRef} allPOIs={POIs ?? []} />
>>>>>>> 30e290a2b3e74d12e0d359073e6b74da796c8d6d

      <MapView
        style={{ flex: 1 }}
        onPress={handleMapPress}
        region={{
          latitude: 30.282,
          longitude: -97.733,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
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

        {/* Render Polylines */}
        {(Route !== null) && (
          <Polyline
            key="RouteLine"
            coordinates={Route}
            strokeColor="#50df49"
            fillColor="rgba(255,0,0,0.5)"
            strokeWidth={4}
          />
        )}

        {/* Render markers */}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={marker.coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => {
<<<<<<< HEAD
              const poi = POIs?.find((p) => String(p.id) === marker.id);
              if (poi) {
                handlePOIPress(poi);
              }
            }}
          />
=======
              if (marker.poiData) handlePOIPress(marker.poiData);
            }}
          >
            {marker.icon && (
              <Image
                source={marker.icon}
                style={{
                  width: marker.isPOI ? markerSize : BASE_ICON_SIZE,
                  height: marker.isPOI ? markerSize : BASE_ICON_SIZE,
                  resizeMode: "contain",
                }}
              />
            )}
          </Marker>
>>>>>>> 30e290a2b3e74d12e0d359073e6b74da796c8d6d
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
          title="Report"
          onPress={() => setIsReportMode(true)}
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
          }}
        />
      )}
    </>
  );
}