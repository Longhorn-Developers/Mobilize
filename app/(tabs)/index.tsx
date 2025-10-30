import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { Stack } from "expo-router";
import { View, Platform, Text, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AvoidanceAreaBottomSheet from "~/components/AvoidanceAreaBottomSheet";
import { Button } from "~/components/Button";
import ReportModal from "~/components/ReportModal";
import { cloudflare } from "~/utils/cloudflare";
import * as turf from "@turf/turf";
import Toast from "react-native-toast-message";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { coordinatesToGeoJSON } from "~/utils/postgis";
import { POIMetadata } from "~/types/database";
import useMapIcons, { FastImage, getMapIcon } from "~/hooks/useMapIcons";
import ErrorBoundary from "~/components/ErrorBoundary";

// Define coordinate type for react-native-maps
interface Coordinates {
  latitude: number;
  longitude: number;
}

const initialCameraPosition = {
  // Default coordinates for UT Tower
  // latitude: 30.28565,
  // longitude: -97.73921,

  // Testing camera position for test avoidance area
  latitude: 30.2672,
  longitude: -97.7333,
  zoom: 16,
};

export default function Home() {
  const insets = useSafeAreaInsets();
  console.log('Home: Safe area insets loaded');
  
  const bottomTabBarHeight = useBottomTabBarHeight();
  console.log('Home: Bottom tab bar height loaded');
  
  console.log('Home: About to call useMapIcons...');
  let mapIcons;
  try {
    mapIcons = useMapIcons();
    console.log('Home: useMapIcons completed, mapIcons:', Object.keys(mapIcons || {}));
  } catch (error) {
    console.error('Home: Failed to load map icons:', error);
    // Return a fallback UI instead of crashing
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
        <Text style={{ fontSize: 16, color: 'black' }}>Error loading map icons. Please restart the app.</Text>
      </View>
    );
  }

  const [isReportMode, setIsReportMode] = useState(false);
  const [aaPointsReport, setAAPointsReport] = useState<Coordinates[]>([]);
  const [clickedPoint, setClickedPoint] = useState<Coordinates | null>(null);
  const [reportStep, setReportStep] = useState(0);
  const [avoidanceAreas, setAvoidanceAreas] = useState<any[]>([]);
  const [POIs, setPOIs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const bottomSheetRef = useRef<BottomSheetModal>(null);

  // Fetch data from Cloudflare API
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        console.log('Home: Starting data fetch...');
        setLoading(true);
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        try {
          // Fetch avoidance areas
          const avoidanceAreasResponse = await fetch(
            `${cloudflare.getBaseUrl()}/avoidance-areas`,
            { signal: controller.signal }
          );
          
          if (avoidanceAreasResponse.ok && isMounted) {
            const avoidanceAreasData = await avoidanceAreasResponse.json();
            setAvoidanceAreas(avoidanceAreasData.avoidance_areas || []);
          }

          // Fetch POIs
          const poisResponse = await fetch(
            `${cloudflare.getBaseUrl()}/pois`,
            { signal: controller.signal }
          );
          
          if (poisResponse.ok && isMounted) {
            const poisData = await poisResponse.json();
            setPOIs(poisData.pois || []);
          }
          
          clearTimeout(timeoutId);
        } catch (fetchError: any) {
          if (fetchError.name !== 'AbortError') {
            throw fetchError;
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        if (isMounted) {
          Toast.show({
            type: "error",
            text2: "Failed to load map data",
            position: "bottom",
            bottomOffset: bottomTabBarHeight + 50,
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    fetchData();
    
    return () => {
      isMounted = false;
    };
  }, [bottomTabBarHeight]);

  const insertAvoidanceArea = async (data: any[]) => {
    try {
      const response = await fetch(`${cloudflare.getBaseUrl()}/avoidance-areas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...cloudflare.getHeaders(),
        },
        body: JSON.stringify({
          name: data[0].name,
          boundary_json: data[0].boundary,
          description: data[0].description,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create avoidance area');
      }

      Toast.show({
        type: "success",
        text2: "Thank you for your review! Your insights are helpful in shaping the community's experience.",
        topOffset: insets.top + 35,
      });

      // Refresh avoidance areas
      const avoidanceAreasResponse = await fetch(`${cloudflare.getBaseUrl()}/avoidance-areas`);
      if (avoidanceAreasResponse.ok) {
        const avoidanceAreasData = await avoidanceAreasResponse.json();
        setAvoidanceAreas(avoidanceAreasData.avoidance_areas || []);
      }
    } catch (error: any) {
      console.error('Error creating avoidance area:', error);
      Toast.show({
        type: "error",
        text2: `Error reporting avoidance area: ${error.message}`,
        position: "bottom",
        bottomOffset: bottomTabBarHeight + 50,
      });
    }
  };


  // Checks if resulting polygon formed by aaPointsReport + points is valid (no kinks)
  const isPointValid = (point: Coordinates) => {
    if (aaPointsReport.length < 3) return true; // Need at least 3 points to form a polygon

    const polygon = turf.polygon([
      [
        ...aaPointsReport.map((p) => [p.longitude || 0, p.latitude || 0]),
        [point.longitude || 0, point.latitude || 0],
        [aaPointsReport[0].longitude || 0, aaPointsReport[0].latitude || 0],
      ],
    ]);
    const kinks = turf.kinks(polygon);

    // No kinks means the polygon is valid
    return kinks.features.length === 0;
  };

  // Check if map pressed is among one of the POIs
  const handlePOIPress = (event: any) => {
    if (!POIs || POIs.length === 0) return;

    const coordinate = event.nativeEvent.coordinate;
    const CLICK_TOLERANCE = 0.0001;
    const POIclicked = POIs.find((poi) => {
      const location = typeof poi.location_json === 'string' 
        ? JSON.parse(poi.location_json) 
        : poi.location_json;
      const lonDiff = Math.abs(
        location.coordinates[0] - coordinate.longitude,
      );
      const latDiff = Math.abs(
        location.coordinates[1] - coordinate.latitude,
      );
      return lonDiff <= CLICK_TOLERANCE && latDiff <= CLICK_TOLERANCE;
    });
    if (POIclicked) {
      console.log(`POI CLICKED: ${POIclicked.id}`);
    }
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
      handlePOIPress(event);
      bottomSheetRef.current?.close();
    }
  };

  // Handle avoidance area click
  const handleAvoidanceAreaPress = (polygon: any) => {
    if (isReportMode) return;
    bottomSheetRef.current?.present(polygon);
  };

  const polygons = useMemo(
    () => {
      const polygonList = [];
      
      // Avoidance areas from the database
      if (avoidanceAreas && avoidanceAreas.length > 0) {
        avoidanceAreas.forEach((area) => {
          try {
            const boundary = typeof area.boundary_json === 'string' 
              ? JSON.parse(area.boundary_json) 
              : area.boundary_json;
            
            // Validate boundary exists and has coordinates
            if (boundary && boundary.coordinates && boundary.coordinates[0] && Array.isArray(boundary.coordinates[0])) {
              const coords = boundary.coordinates[0].map((coord: number[]) => ({
                longitude: coord[0],
                latitude: coord[1],
              }));
              
              // Only add if coordinates array is not empty
              if (coords.length > 0) {
                polygonList.push({
                  key: area.id,
                  coordinates: coords,
                  fillColor: "rgba(255, 0, 0, 0.25)",
                  strokeColor: "rgba(255, 0, 0, 0.5)",
                  strokeWidth: 1,
                });
              }
            }
          } catch (error) {
            console.error('Error parsing boundary for area:', area.id, error);
          }
        });
      }
      
      // User selected aaPoints to report - only include if not empty
      if (aaPointsReport && aaPointsReport.length > 0) {
        polygonList.push({
          key: 'user-report',
          coordinates: aaPointsReport,
          fillColor: "rgba(255, 0, 0, 0.25)",
          strokeColor: "red",
          strokeWidth: 2,
        });
      }
      
      return polygonList;
    },
    [avoidanceAreas, aaPointsReport],
  );

  const markers = useMemo(
    () => [
      // User selected aaPoints to report
      ...aaPointsReport.map((point, index) => ({
        key: `report-point-${index}`,
        coordinate: point,
        icon: mapIcons.crosshair,
        title: undefined,
        description: undefined,
      })),
      // Clicked point
      ...(clickedPoint ? [{
        key: 'clicked-point',
        coordinate: clickedPoint,
        icon: mapIcons.crosshair,
        title: undefined,
        description: undefined,
      }] : []),
      // POIs only show if not in report mode
      ...(!isReportMode
        ? (POIs || []).map((poi) => {
            const location = typeof poi.location_json === 'string' 
              ? JSON.parse(poi.location_json) 
              : poi.location_json;
            const metadata = typeof poi.metadata === 'string' 
              ? JSON.parse(poi.metadata) 
              : poi.metadata;
            return {
              key: poi.id,
              coordinate: {
                longitude: location.coordinates[0],
                latitude: location.coordinates[1],
              },
              icon: getMapIcon(poi.type || 'point', metadata || {}, mapIcons),
              title: metadata?.name || 'POI',
              description: `${metadata?.bld_name || 'Building'} - Floor ${metadata?.floor || 'N/A'}`,
            };
          })
        : []),
    ],
    [POIs, aaPointsReport, isReportMode, clickedPoint, mapIcons],
  );


  // Add safety check for mapIcons
  if (!mapIcons || Object.keys(mapIcons).length === 0) {
    console.error('Home: MapIcons not loaded properly');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
        <Text style={{ fontSize: 16, color: 'black' }}>Loading map icons...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Home", headerShown: false }} />

      {/* Avoidance Area Bottom Sheet */}
      <AvoidanceAreaBottomSheet ref={bottomSheetRef} />

      <MapView
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: initialCameraPosition.latitude,
          longitude: initialCameraPosition.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onPress={handleMapPress}
      >
        {/* Polygons */}
        {polygons.map((polygon) => (
          <Polygon
            key={polygon.key}
            coordinates={polygon.coordinates}
            fillColor={polygon.fillColor}
            strokeColor={polygon.strokeColor}
            strokeWidth={polygon.strokeWidth}
            onPress={() => handleAvoidanceAreaPress(polygon)}
          />
        ))}
        
        {/* Markers */}
        {markers.map((marker) => {
          try {
            // Ensure icon is always defined with fallback
            const iconSource = marker.icon || mapIcons.point;
            
            // For Android Google Maps, use Image.resolveAssetSource format directly
            // The source object from resolveAssetSource has the correct format
            // Add null checks to prevent crashes
            let imageSource = null;
            if (iconSource && iconSource.source && iconSource.source.uri) {
              // Use resolved source if it has a URI
              imageSource = iconSource.source;
            } else if (iconSource && iconSource.source) {
              // Use source even if URI might not be set
              imageSource = iconSource.source;
            } else if (iconSource && iconSource.require) {
              imageSource = iconSource.require;
            } else if (mapIcons && mapIcons.point && mapIcons.point.source) {
              // Ultimate fallback
              imageSource = mapIcons.point.source;
            } else if (mapIcons && mapIcons.point && mapIcons.point.require) {
              imageSource = mapIcons.point.require;
            }
            
            // Only add image prop if we have a valid source
            const markerProps: any = {
              key: marker.key,
              coordinate: marker.coordinate,
              title: marker.title,
              description: marker.description,
              tracksViewChanges: false,
            };
            
            if (imageSource) {
              markerProps.image = imageSource;
            }
            
            return <Marker {...markerProps} />;
          } catch (error) {
            console.error('Error rendering marker:', marker.key, error);
            // Return a basic marker without custom icon as fallback
            return (
              <Marker
                key={marker.key}
                coordinate={marker.coordinate}
                title={marker.title}
                description={marker.description}
                tracksViewChanges={false}
              />
            );
          }
        })}
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
              await insertAvoidanceArea([
                {
                  name: data.description,
                  boundary: coordinatesToGeoJSON(aaPoints),
                  description: data.description,
                },
              ]);
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
