import { BottomSheetModal } from "@gorhom/bottom-sheet";
import * as turf from "@turf/turf";
import { Stack } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { View, Image } from "react-native";
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
  useInsertAvoidanceArea,
} from "~/utils/api-hooks";
import useMapIcons from "~/utils/useMapIcons";

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
  const bottomTabBarHeight = 50;
  const avoidanceAreaBottomSheetRef = useRef<BottomSheetModal>(null);
  const poiBottomSheetRef = useRef<BottomSheetModal>(null);

  // states
  const [isReportMode, setIsReportMode] = useState(false);
  const [aaPointsReport, setAAPointsReport] = useState<LatLng[]>([]);
  const [clickedPoint, setClickedPoint] = useState<LatLng | null>(null);
  const [reportStep, setReportStep] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(15);

  const markerSize = useMemo(() => {
    const scale = Math.pow(2, zoomLevel - BASE_ZOOM);
    return Math.min(Math.max(BASE_ICON_SIZE * scale, ICON_SCALE), MAX_ICON_SIZE);
  }, [zoomLevel]);

  // query hooks
  const { data: avoidanceAreas } = useAvoidanceAreas();
  const { data: POIs } = usePOIs();
  const { mutateAsync: insertAvoidanceArea } = useInsertAvoidanceArea();

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
    if (isReportMode) return;
    avoidanceAreaBottomSheetRef.current?.present({ id: polygonId });
  };

  // Handle POI click
  const handlePOIPress = (poi: any) => {
    if (isReportMode) return;
    poiBottomSheetRef.current?.present({ poi, clusteredPOIs: poi.clusteredPOIs ?? [poi] });
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

  return (
    <>
      <Stack.Screen options={{ title: "Home", headerShown: false }} />

      {/* Avoidance Area Bottom Sheet */}
      <AvoidanceAreaBottomSheet ref={avoidanceAreaBottomSheetRef} />
      
      {/* POI Bottom Sheet */}
      <POIBottomSheet ref={poiBottomSheetRef} allPOIs={POIs ?? []} />

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