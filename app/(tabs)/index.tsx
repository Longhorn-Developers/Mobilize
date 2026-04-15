import { BottomSheetModal } from "@gorhom/bottom-sheet";
import * as turf from "@turf/turf";
import { Stack } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { View, Image } from "react-native";
import MapView, { Polygon, Marker, LatLng, Polyline } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import AvoidanceAreaBottomSheet from "~/components/AvoidanceAreaBottomSheet";
import { Button } from "~/components/Button";
import {
  LocationDetailsBottomSheet,
  type LocationDetailsBottomSheetRef,
} from "~/components/LocationDetailsBottomSheet";
import POIBottomSheet, { POIReviewData } from "~/components/POIBottomSheet";
import ReportModal from "~/components/ReportModal";
import ReviewModal from "~/components/ReviewModal";
import { SearchBar } from "~/components/SearchBar";
import { SearchDropdown } from "~/components/SearchDropdown";
import {
  usePOIs,
  useAvoidanceAreas,
  useConstructionAreas,
  useInsertAvoidanceArea,
  getRoute
} from "~/utils/api-hooks";
import decode from "~/utils/decode_polyline";
import { PlaceDetails, searchPlaces, getPlaceDetails } from "~/utils/googlePlaces";
import useMapIcons from "~/utils/useMapIcons";
import buildingsData from "../../assets/geojson/buildings_simple.json";

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

export default function Home() {
  // hooks
  const insets = useSafeAreaInsets();
  const mapIcons = useMapIcons();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const mapRef = useRef<MapView>(null);
  const avoidanceAreaBottomSheetRef = useRef<BottomSheetModal>(null);
  const poiBottomSheetRef = useRef<BottomSheetModal>(null);
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const reviewSheetRef = useRef<BottomSheetModal>(null);
  const locationBottomSheetRef = useRef<LocationDetailsBottomSheetRef>(null);

  // states
  const [isReportMode, setIsReportMode] = useState(false);
  const [aaPointsReport, setAAPointsReport] = useState<LatLng[]>([]);
  const [clickedPoint, setClickedPoint] = useState<LatLng | null>(null);
  const [reportStep, setReportStep] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(15);
  const [Route, setRoute] = useState<LatLng[] | null>(null);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const markerSize = useMemo(() => {
    const scale = Math.pow(2, zoomLevel - BASE_ZOOM);
    return Math.min(Math.max(BASE_ICON_SIZE * scale, ICON_SCALE), MAX_ICON_SIZE);
  }, [zoomLevel]);

  // Reviews
  const [reviewKey, setReviewKey] = useState(0);
  const [poi, setPoi] = useState<POIReviewData>();
  const handleSetPoi = useCallback((poi: POIReviewData | undefined) => {
    setPoi(poi);
  }, []);

  // query hooks
  const { data: avoidanceAreas } = useAvoidanceAreas();
  const { data: constructionAreas } = useConstructionAreas();
  const { data: POIs } = usePOIs();
  const { mutateAsync: insertAvoidanceArea } = useInsertAvoidanceArea();
  // getRoute([[-97.733785,30.282635],[-97.733731,30.285145]], [[[-97.734269,30.284691],[-97.733454,30.284654],[-97.733669,30.283366],[-97.734708,30.283932],[-97.734269,30.284691]]]);

  // COMMENT THIS OUT WHEN TESTING!!!!! DONT CALL IF NOT NEEDED

  // const testGooglePlaces = async () => {
  //   console.log("Testing Google Places...");
  //   const results = await searchPlaces("Texas Global");
  //   console.log("Search results:", results);
  //
  //   if (results.length > 0) {
  //     const details = await getPlaceDetails(results[0].place_id);
  //     console.log("Place details:", details);
  //   }
  // };

  // useEffect(() => {
  //   testGooglePlaces();
  // }, []);

  const findCampusBuildingFeature = (
    latitude: number,
    longitude: number,
    placeName?: string,
    placeAddress?: string,
  ) => {
    const point = turf.point([longitude, latitude]);
    const buildingsAny = buildingsData as any;
    const features: any[] = buildingsAny.features ?? [];

    const polygonMatch = features.find((feature) =>
      feature?.geometry && turf.booleanPointInPolygon(point, feature),
    );

    if (polygonMatch) {
      return polygonMatch;
    }

    // Only trust strict polygon containment.
    // If we cannot confidently match, fall back to the generic location sheet.
    return null;
  };

  const buildPoiFromCampusBuilding = (
    placeDetails: any,
    buildingFeature: any,
  ) => {
    const buildingAbbr = buildingFeature?.properties?.Building_Abbr;
    const buildingName = buildingFeature?.properties?.Description;

    if (!buildingAbbr || !buildingName) {
      return null;
    }

    return {
      id: `search-${placeDetails.place_id ?? buildingAbbr}`,
      poi_type: "accessible_entrance",
      location_geojson: {
        type: "Point",
        coordinates: [
          placeDetails.geometry.location.lng,
          placeDetails.geometry.location.lat,
        ],
      },
      metadata: {
        name: buildingName,
        bld_name: `(${buildingAbbr}) ${buildingName}`,
      },
    };
  };

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
    poiBottomSheetRef.current?.present({ poi });
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
        // User selected aaPoints to report
        ...aaPointsReport.map((point, index) => ({
          id: `report-point-${index}`,
          coordinate: point,
          icon: mapIcons.point || undefined,
          isPOI: false,
          poiData: null,
        })),
        // Clicked point
        ...(clickedPoint
          ? [
              {
                id: "clicked-point",
                coordinate: clickedPoint,
                icon: mapIcons.crosshair || undefined,
                isPOI: false,
                poiData: null,
              },
            ]
          : []),
        // POIs only show if not in report mode
        ...poiMarkers,
      ];
    },
    [clusteredPOIs, aaPointsReport, mapIcons, getMapIcon, isReportMode, clickedPoint, zoomLevel],
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

    // Resolve missing place_id for recent/manual locations so recenter still works.
    let resolvedPlaceId = location.place_id;
    if (!resolvedPlaceId) {
      const primaryQuery = [location.name, location.address].filter(Boolean).join(" ");
      const fallbackQuery = location.name;

      const primaryResults = await searchPlaces(primaryQuery);
      resolvedPlaceId = primaryResults[0]?.place_id;

      if (!resolvedPlaceId && fallbackQuery) {
        const fallbackResults = await searchPlaces(fallbackQuery);
        resolvedPlaceId = fallbackResults[0]?.place_id;
      }
    }

    // Fetch full place details
    if (resolvedPlaceId) {
      const placeDetails = await getPlaceDetails(resolvedPlaceId);

      if (placeDetails) {
        const matchingBuilding = findCampusBuildingFeature(
          placeDetails.geometry.location.lat,
          placeDetails.geometry.location.lng,
          placeDetails.name,
          placeDetails.formatted_address,
        );

        mapRef.current?.animateToRegion(
          {
            latitude: placeDetails.geometry.location.lat,
            longitude: placeDetails.geometry.location.lng,
            latitudeDelta: 0.006,
            longitudeDelta: 0.006,
          },
          450,
        );

        const buildingPoi = buildPoiFromCampusBuilding(
          placeDetails,
          matchingBuilding,
        );

        if (buildingPoi) {
          locationBottomSheetRef.current?.dismiss();
          poiBottomSheetRef.current?.present({ poi: buildingPoi });
        } else {
          // Open the generic sheet when we cannot map the place to an official building.
          locationBottomSheetRef.current?.present(placeDetails);
        }
      }
    } else {
      console.error("Could not resolve place_id for selected location", location);
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

  const handleEnterReviewMode = useCallback(() => {
    setReviewKey(prevKey => prevKey + 1);
    reviewSheetRef.current?.present();
  }, []);

  const handleExitReviewMode = () => {
    reviewSheetRef.current?.forceClose();
  }

  const emptyPOIs = useMemo(() => [], []);

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
    {/* !isReportMode && (
      <SearchDropdown
        visible={isSearchActive}
        searchQuery={searchQuery}
        onSelectLocation={handleSelectLocation}
        onDismiss={handleDismissSearch}
        topOffset={insets.top + 70}
      />
    ) */}

      {/* Avoidance Area Bottom Sheet */}
      <AvoidanceAreaBottomSheet ref={avoidanceAreaBottomSheetRef} />

      {/* POI Bottom Sheet */}
      <POIBottomSheet
        ref={poiBottomSheetRef}
        allPOIs={POIs ?? emptyPOIs}
        handleReviews={handleEnterReviewMode}
        setPoi={handleSetPoi}
      />

    {/* Location Details Bottom Sheet */}
    {/* <LocationDetailsBottomSheet ref={locationBottomSheetRef} /> */}

    {/* Review Modal */}
    <BottomSheetModal
      ref={reviewSheetRef}
      bottomInset={bottomTabBarHeight}
      backgroundStyle={{ backgroundColor: "transparent" }}
      enableDynamicSizing={false}
      snapPoints={["100%"]}
      enableContentPanningGesture={false}
      handleComponent={null}
      stackBehavior="push"
      animationConfigs={{ duration: 0.1 }}
      animateOnMount={false}
    >
      <ReviewModal
        key={reviewKey}
        className=""
        poi_id={poi ? poi.id : 0}
        entrances={poi ? poi.entrances : []}
        entranceName={poi ? poi.entrance : "No Entrance Name Found"} // based on bottom sheet selection
        building={poi && poi.building}
        buildingName={poi ? poi.buildingName : "No Building Name Found"} // from bottom sheet/places api
        onExit={handleExitReviewMode}
      />
    </BottomSheetModal>

      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        onPress={handleMapPress}
        initialRegion={{
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
