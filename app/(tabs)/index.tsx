import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { Stack } from "expo-router";
import { View, Platform, Text, ActivityIndicator, Image, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import AvoidanceAreaBottomSheet from "~/components/AvoidanceAreaBottomSheet";
import { Button } from "~/components/Button";
import ReportModal from "~/components/ReportModal";
import { cloudflare } from "~/utils/cloudflare";
import * as turf from "@turf/turf";
import Toast from "react-native-toast-message";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { coordinatesToGeoJSON } from "~/utils/postgis";
import { POIMetadata } from "~/types/database";
import useMapIcons, { getMapIcon } from "~/hooks/useMapIcons";
import { useMapSettings } from "~/contexts/MapSettingsContext";
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
  const { settings } = useMapSettings();
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight();
  
  // Hooks must be called unconditionally at the top level
  const mapIcons = useMapIcons();

  const [isReportMode, setIsReportMode] = useState(false);
  const [aaPointsReport, setAAPointsReport] = useState<Coordinates[]>([]);
  const [clickedPoint, setClickedPoint] = useState<Coordinates | null>(null);
  const [reportStep, setReportStep] = useState(0);
  const [avoidanceAreas, setAvoidanceAreas] = useState<any[]>([]);
  const [POIs, setPOIs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [markersReady, setMarkersReady] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);

  const bottomSheetRef = useRef<BottomSheetModal>(null);

  // Request location permission and get user location
  const requestLocationPermission = useCallback(async (shouldCenter: boolean = false) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return false;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserLocation(coords);
      
      if (shouldCenter && mapRef.current) {
        mapRef.current.animateToRegion({
          ...coords,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }
      
      return true;
    } catch (error) {
      console.error('Error getting location:', error);
      return false;
    }
  }, []);

  // Request location on initial load (only once)
  useEffect(() => {
    const timer = setTimeout(() => {
      Alert.alert(
        'Location Access',
        'Would you like to share your location so we can center the map on your current position?',
        [
          {
            text: 'No',
            style: 'cancel',
            onPress: () => {
              // Keep default camera position
            },
          },
          {
            text: 'Yes',
            onPress: async () => {
              await requestLocationPermission(true);
            },
          },
        ]
      );
    }, 500); // Small delay to let map initialize

    return () => clearTimeout(timer);
  }, []); // Only run once on mount

  // Simple Google-like dark map style (only for standard map type)
  const darkMapStyle = useMemo(
    () => [
      { elementType: "geometry", stylers: [{ color: "#1f2937" }] },
      { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#e5e7eb" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#1f2937" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#374151" }] },
      { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#d1d5db" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#111827" }] },
      { featureType: "poi", elementType: "labels.text", stylers: [{ visibility: "off" }] },
      { featureType: "transit", stylers: [{ visibility: "off" }] },
    ],
    []
  );

  // Only apply custom map style for standard map type and dark theme
  // Custom styles override map types, so we need to disable them for satellite/terrain/hybrid
  // IMPORTANT: Custom styles completely override map types, so we must use undefined/null for non-standard types
  // Also need to ensure the style is cleared when map type changes
  const customMapStyleValue = useMemo(() => {
    if (settings.mapType === "standard" && settings.theme === "dark") {
      return darkMapStyle;
    }
    return undefined;
  }, [settings.mapType, settings.theme]);

  // Handle map loaded callback to enable markers optimization
  const handleMapLoaded = useCallback(() => {
    // Give Google Maps a tick to settle
    requestAnimationFrame(() => setMarkersReady(true));
  }, []);

  // Fetch data from Cloudflare API
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        //console.log('Home: Starting data fetch...');
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

  // Check if map pressed is among one of the POIs (disabled - no popup)
  const handlePOIPress = (event: any) => {
    // POI click handling disabled - no popup/directions
    return;
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
    // Find the avoidance area by matching the polygon key/coordinates
    const area = avoidanceAreas.find((area) => {
      if (area.id === polygon.key) return true;
      try {
        const boundary = typeof area.boundary_json === 'string' 
          ? JSON.parse(area.boundary_json) 
          : area.boundary_json;
        // Simple check - if the key matches the ID, it's the same area
        return area.id === polygon.key;
      } catch {
        return false;
      }
    });
    
    if (area) {
      setSelectedAreaId(area.id);
      bottomSheetRef.current?.present();
    }
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
                  id: area.id,
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
    () => {
      const markerArray = [
        // User selected aaPoints to report
        ...aaPointsReport.map((point, index) => ({
          key: `report-point-${index}`,
          coordinate: point,
          iconRequire: mapIcons.crosshair.require,
          title: undefined,
          description: undefined,
        })),
        // Clicked point
        ...(clickedPoint ? [{
          key: 'clicked-point',
          coordinate: clickedPoint,
          iconRequire: mapIcons.crosshair.require,
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
              const iconObj = getMapIcon(poi.type || 'point', metadata || {}, mapIcons);
              console.log(metadata);
              return {
                key: poi.id,
                coordinate: {
                  longitude: location.coordinates[0],
                  latitude: location.coordinates[1],
                },
                metadata: metadata,
                metadataType: poi.type,
                metadataAutoOpene: metadata.auto_opene,
                metadataBldName: metadata.bld_name,
                metadataFloor: metadata.floor,
                metadataName: metadata.name,
                iconRequire: iconObj.require,
                title: metadata?.name || 'POI',
                description: `${metadata?.bld_name || 'Building'} - Floor ${metadata?.floor || 'N/A'}`,
              };
            })
          : []),
      ];
      
      return markerArray;
    },
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
      <AvoidanceAreaBottomSheet ref={bottomSheetRef} selectedAreaId={selectedAreaId || undefined} />

      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: initialCameraPosition.latitude,
          longitude: initialCameraPosition.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onPress={handleMapPress}
        onMapLoaded={handleMapLoaded}
        mapType={settings.mapType}
        showsTraffic={settings.showsTraffic}
        showsBuildings={settings.showsBuildings}
        showsUserLocation={!!userLocation}
        showsCompass={settings.showsCompass}
        customMapStyle={customMapStyleValue}
        mapPadding={markersReady ? {
          bottom: bottomTabBarHeight + 12,
          right: 12,
          left: 0,
          top: 0,
        } : undefined}
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
            // Use the iconRequire that was already determined in the markerArray
            console.log('marker', marker);
            let iconRequire;
            console.log(marker.metadataAutoOpene);
            if (marker.metadataAutoOpene) {
              iconRequire = mapIcons.autoDoor.require;
            } else {
              iconRequire = mapIcons.manualDoor.require;
            }
            
            const commonProps: any = {
              coordinate: marker.coordinate,
              title: marker.title,
              description: marker.description,
              // Keep updates ON until map renders at least once
              tracksViewChanges: !markersReady,
              tappable: false,
            };

            // Use image prop with the require() result from markerArray
            // Render icon as child Image to control size
            
            return (
              <Marker
                key={marker.key}
                {...commonProps}
                anchor={{ x: 0.5, y: 1 }}
              >
                <Image
                  source={iconRequire}
                  style={{ width: 32, height: 32 }}
                  resizeMode="contain"
                />
              </Marker>
            );
          } catch (err) {
            console.error("Error rendering marker:", marker.key, err);
            return <Marker key={marker.key} coordinate={marker.coordinate} />;
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
            theme={settings.theme}
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
        <>
          {/* Bottom right button to enter report mode */}
          <Button
            className="absolute bottom-4 right-4"
            title={"Report"}
            onPress={() => setIsReportMode(true)}
          />
        </>
      )}
    </>
  );
}
