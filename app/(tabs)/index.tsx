import { BottomSheetModal } from "@gorhom/bottom-sheet";
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { Stack } from "expo-router";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { View, Platform } from "react-native";
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
import useMapIcons from "~/hooks/useMapIcons";

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
  const bottomTabBarHeight = useBottomTabBarHeight();
  const mapIcons = useMapIcons();

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
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch avoidance areas
        const avoidanceAreasResponse = await fetch(`${cloudflare.baseUrl}/avoidance-areas`);
        if (avoidanceAreasResponse.ok) {
          const avoidanceAreasData = await avoidanceAreasResponse.json();
          setAvoidanceAreas(avoidanceAreasData.avoidance_areas || []);
        }

        // Fetch POIs
        const poisResponse = await fetch(`${cloudflare.baseUrl}/pois`);
        if (poisResponse.ok) {
          const poisData = await poisResponse.json();
          setPOIs(poisData.pois || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        Toast.show({
          type: "error",
          text2: "Failed to load map data",
          position: "bottom",
          bottomOffset: bottomTabBarHeight + 50,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const insertAvoidanceArea = async (data: any[]) => {
    try {
      const response = await fetch(`${cloudflare.baseUrl}/avoidance-areas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...cloudflare.getAuthHeaders(),
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
      const avoidanceAreasResponse = await fetch(`${cloudflare.baseUrl}/avoidance-areas`);
      if (avoidanceAreasResponse.ok) {
        const avoidanceAreasData = await avoidanceAreasResponse.json();
        setAvoidanceAreas(avoidanceAreasData.avoidance_areas || []);
      }
    } catch (error) {
      console.error('Error creating avoidance area:', error);
      Toast.show({
        type: "error",
        text2: `Error reporting avoidance area: ${error.message}`,
        position: "bottom",
        bottomOffset: bottomTabBarHeight + 50,
      });
    }
  };

  const getMapIcon = useCallback(
    (poiType: string, metadata: POIMetadata) => {
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
    () => [
      // Avoidance areas from the database
      ...(avoidanceAreas || []).map((area) => {
        const boundary = typeof area.boundary_json === 'string' 
          ? JSON.parse(area.boundary_json) 
          : area.boundary_json;
        return {
          key: area.id,
          coordinates: boundary.coordinates[0].map((coord: number[]) => ({
            longitude: coord[0],
            latitude: coord[1],
          })),
          fillColor: "rgba(255, 0, 0, 0.25)",
          strokeColor: "rgba(255, 0, 0, 0.5)",
          strokeWidth: 1,
        };
      }),
      // User selected aaPoints to report
      {
        key: 'user-report',
        coordinates: aaPointsReport,
        fillColor: "rgba(255, 0, 0, 0.25)",
        strokeColor: "red",
        strokeWidth: 2,
      },
    ],
    [avoidanceAreas, aaPointsReport],
  );

  const markers = useMemo(
    () => [
      // User selected aaPoints to report
      ...aaPointsReport.map((point, index) => ({
        key: `report-point-${index}`,
        coordinate: point,
        pinColor: 'red',
      })),
      // Clicked point
      ...(clickedPoint ? [{
        key: 'clicked-point',
        coordinate: clickedPoint,
        pinColor: 'blue',
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
              pinColor: metadata.auto_opene ? 'green' : 'orange',
              title: metadata.name || 'POI',
              description: `${metadata.bld_name || 'Building'} - Floor ${metadata.floor || 'N/A'}`,
            };
          })
        : []),
    ],
    [POIs, aaPointsReport, isReportMode, clickedPoint],
  );


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
        {markers.map((marker) => (
          <Marker
            key={marker.key}
            coordinate={marker.coordinate}
            pinColor={marker.pinColor}
            title={marker.title}
            description={marker.description}
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
