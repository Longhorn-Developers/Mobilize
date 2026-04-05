import Mapbox, {
  Camera,
  CircleLayer,
  FillExtrusionLayer,
  FillLayer,
  Images,
  LineLayer,
  MapView,
  PointAnnotation,
  RasterDemSource,
  ShapeSource,
  SkyLayer,
  SymbolLayer,
  Terrain,
} from "@rnmapbox/maps";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as turf from "@turf/turf";
import { Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, InteractionManager, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import AvoidanceAreaBottomSheet from "~/components/AvoidanceAreaBottomSheet";
import BarrierBottomSheet from "~/components/BarrierBottomSheet";
import BuildingBottomSheet from "~/components/BuildingBottomSheet";
import { Button } from "~/components/Button";
import ConstructionBottomSheet from "~/components/ConstructionBottomSheet";
import {
  LocationDetailsBottomSheet,
  type LocationDetailsBottomSheetRef,
} from "~/components/LocationDetailsBottomSheet";
import POIBottomSheet from "~/components/POIBottomSheet";
import ReportModal from "~/components/ReportModal";
import { SearchBar } from "~/components/SearchBar";
import { SearchDropdown } from "~/components/SearchDropdown";
import SidewalkBottomSheet, { type SidewalkSegment } from "~/components/SidewalkBottomSheet";
import {
  useAvoidanceAreas,
  useConstructionAreas,
  useInsertAvoidanceArea,
  usePOIs,
} from "~/utils/api-hooks";
import { getPlaceDetails, searchPlaces } from "~/utils/mapboxSearch";
import { useAuth } from "~/utils/useAuth";
import useMapIcons from "~/utils/useMapIcons";

// Initialise Mapbox
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "");

// ── Constants ──────────────────────────────────────────────────────────────────
const UT_CENTER: [number, number] = [-97.733, 30.282];
const MIN_ZOOM_FOR_POIS = 16;
const MIN_ZOOM_FOR_SIDEWALKS = 17;
const MIN_ZOOM_FOR_BUILDINGS = 14;
const MIN_ZOOM_FOR_BARRIERS = 16;

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

type LatLng = { latitude: number; longitude: number };

// ──────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const insets = useSafeAreaInsets();
  const mapIcons = useMapIcons();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const { user } = useAuth();
  const canReport = user?.role === "student";

  // Refs
  const cameraRef = useRef<Camera>(null);
  const avoidanceAreaBottomSheetRef = useRef<BottomSheetModal>(null);
  const poiBottomSheetRef = useRef<BottomSheetModal>(null);
  const locationBottomSheetRef = useRef<LocationDetailsBottomSheetRef>(null);
  const sidewalkBottomSheetRef = useRef<BottomSheetModal>(null);
  const buildingBottomSheetRef = useRef<BottomSheetModal>(null);
  const barrierBottomSheetRef = useRef<BottomSheetModal>(null);
  const constructionBottomSheetRef = useRef<BottomSheetModal>(null);
  // Suppress MapView.onPress when a feature layer already handled the tap
  const featureTappedRef = useRef(false);

  // GeoJSON — loaded asynchronously after first render so the app doesn't freeze on startup
  const [sidewalksGeoJSON, setSidewalksGeoJSON] = useState<GeoJSON.FeatureCollection>(EMPTY_FC);
  const [buildingsGeoJSON, setBuildingsGeoJSON] = useState<GeoJSON.FeatureCollection>(EMPTY_FC);
  const [barriersGeoJSON, setBarriersGeoJSON] = useState<GeoJSON.FeatureCollection>(EMPTY_FC);

  useEffect(() => {
    // Run after interactions so the map renders first, then overlays load
    InteractionManager.runAfterInteractions(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      setSidewalksGeoJSON(require("../../assets/geojson/sidewalks_slim.json"));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      setBuildingsGeoJSON(require("../../assets/geojson/buildings_simple.json"));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      setBarriersGeoJSON(require("../../assets/geojson/UTA_Access_Barriers.json"));
    });
  }, []);

  // State
  const [isReportMode, setIsReportMode] = useState(false);
  const [aaPointsReport, setAAPointsReport] = useState<LatLng[]>([]);
  const [clickedPoint, setClickedPoint] = useState<LatLng | null>(null);
  const [reportStep, setReportStep] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(15);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Data
  const { data: avoidanceAreas } = useAvoidanceAreas();
  const { data: constructionAreas } = useConstructionAreas();
  const { data: POIs } = usePOIs();
  const { mutateAsync: insertAvoidanceArea } = useInsertAvoidanceArea();

  // ── GeoJSON sources ────────────────────────────────────────────────────────

  const avoidanceGeoJSON = useMemo(
    (): GeoJSON.FeatureCollection => ({
      type: "FeatureCollection",
      features: (avoidanceAreas ?? []).map((area) => ({
        type: "Feature" as const,
        id: String(area.id),
        properties: { id: String(area.id) },
        geometry: area.boundary_geojson as GeoJSON.Geometry,
      })),
    }),
    [avoidanceAreas],
  );

  const constructionGeoJSON = useMemo(
    (): GeoJSON.FeatureCollection => ({
      type: "FeatureCollection",
      features: (constructionAreas ?? []).flatMap((area) => {
        const coords = area.points.map(
          (c: [number, number]) => [c[1], c[0]] as [number, number],
        );
        if (coords.length < 3) return [];
        const ring: [number, number][] =
          coords[0][0] === coords[coords.length - 1][0] &&
          coords[0][1] === coords[coords.length - 1][1]
            ? coords
            : [...coords, coords[0]];
        return [
          {
            type: "Feature" as const,
            id: `C${area.id}`,
            properties: { id: `C${area.id}` },
            geometry: {
              type: "Polygon",
              coordinates: [ring],
            } satisfies GeoJSON.Polygon,
          },
        ];
      }),
    }),
    [constructionAreas],
  );

  // POI features as GeoJSON for SymbolLayer rendering
  const poiGeoJSON = useMemo(
    (): GeoJSON.FeatureCollection => ({
      type: "FeatureCollection",
      features: (POIs ?? []).map((poi) => ({
        type: "Feature" as const,
        id: String(poi.id),
        properties: {
          id: String(poi.id),
          icon: poi.metadata?.auto_opene ? "autoDoor" : "manualDoor",
        },
        geometry: poi.location_geojson as GeoJSON.Geometry,
      })),
    }),
    [POIs],
  );

  // In-progress polygon while drawing a report
  const reportGeoJSON = useMemo((): GeoJSON.FeatureCollection | null => {
    if (aaPointsReport.length < 2) return null;
    const coords = aaPointsReport.map(
      (p) => [p.longitude, p.latitude] as [number, number],
    );
    const geometry: GeoJSON.Geometry =
      aaPointsReport.length >= 3
        ? { type: "Polygon", coordinates: [[...coords, coords[0]]] }
        : { type: "LineString", coordinates: coords };
    return {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry }],
    };
  }, [aaPointsReport]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const isPointValid = (point: LatLng) => {
    if (aaPointsReport.length < 3) return true;
    const polygon = turf.polygon([
      [
        ...aaPointsReport.map((p) => [p.longitude, p.latitude]),
        [point.longitude, point.latitude],
        [aaPointsReport[0].longitude, aaPointsReport[0].latitude],
      ],
    ]);
    return turf.kinks(polygon).features.length === 0;
  };

  const handleMapTap = (coordinate: LatLng) => {
    if (!isReportMode || reportStep !== 0) return;
    if (isPointValid(coordinate)) {
      setClickedPoint(coordinate);
      setAAPointsReport((prev) => [...prev, coordinate]);
    } else {
      Toast.show({
        type: "error",
        text2: "Invalid point! Please select a different point.",
        position: "bottom",
        bottomOffset: bottomTabBarHeight + 50,
      });
    }
  };

  const closeAllSheets = () => {
    avoidanceAreaBottomSheetRef.current?.close();
    poiBottomSheetRef.current?.close();
    sidewalkBottomSheetRef.current?.close();
    buildingBottomSheetRef.current?.close();
    barrierBottomSheetRef.current?.close();
    constructionBottomSheetRef.current?.close();
  };

  const handleAvoidanceAreaPress = (polygonId: string) => {
    const area = (avoidanceAreas ?? []).find((a) => String(a.id) === polygonId);
    if (!area) return;
    avoidanceAreaBottomSheetRef.current?.present({ area });
  };

  const handleSidewalkPress = (segment: SidewalkSegment) => {
    sidewalkBottomSheetRef.current?.present({ segment });
  };

  const handlePOIPress = (poi: any) => {
    poiBottomSheetRef.current?.present({ poi });
  };

  const handleBuildingPress = (properties: Record<string, any>) => {
    buildingBottomSheetRef.current?.present({ building: properties });
  };

  const handleBarrierPress = (properties: Record<string, any>) => {
    barrierBottomSheetRef.current?.present({ barrier: properties });
  };

  const handleConstructionPress = (id: string, description?: string) => {
    constructionBottomSheetRef.current?.present({ construction: { id, description } });
  };

  const handleSelectLocation = async (location: {
    id: string;
    name: string;
    address?: string;
    place_id?: string;
  }) => {
    setIsSearchActive(false);
    setSearchQuery("");
    if (location.place_id) {
      const placeDetails = await getPlaceDetails(location.place_id);
      if (placeDetails) {
        locationBottomSheetRef.current?.present(placeDetails);
        const { lat, lng } = placeDetails.geometry?.location ?? {};
        if (lat != null && lng != null) {
          cameraRef.current?.setCamera({
            centerCoordinate: [lng, lat],
            zoomLevel: 18,
            animationDuration: 800,
          });
        }
      }
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (!isSearchActive && text.length > 0) setIsSearchActive(true);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ title: "Home", headerShown: false }} />

      {/* Search bar — hidden in report mode */}
      {!isReportMode && (
        <SearchBar
          onPress={() => setIsSearchActive(true)}
          onChangeText={handleSearchChange}
          onClear={() => setSearchQuery("")}
          value={searchQuery}
          editable={isSearchActive}
          isActive={isSearchActive}
          className="absolute left-4 right-4 z-20"
          style={{ top: insets.top + 10 }}
        />
      )}

      {/* Search results dropdown */}
      {!isReportMode && (
        <SearchDropdown
          visible={isSearchActive}
          searchQuery={searchQuery}
          onSelectLocation={handleSelectLocation}
          onDismiss={() => {
            setIsSearchActive(false);
            setSearchQuery("");
          }}
          topOffset={insets.top + 70}
        />
      )}

      {/* Bottom sheets */}
      <AvoidanceAreaBottomSheet ref={avoidanceAreaBottomSheetRef} />
      <POIBottomSheet ref={poiBottomSheetRef} allPOIs={POIs ?? []} />
      <SidewalkBottomSheet ref={sidewalkBottomSheetRef} />
      <LocationDetailsBottomSheet ref={locationBottomSheetRef} />
      <BuildingBottomSheet ref={buildingBottomSheetRef} />
      <BarrierBottomSheet ref={barrierBottomSheetRef} />
      <ConstructionBottomSheet ref={constructionBottomSheetRef} />

      {/* ── Mapbox Map ─────────────────────────────────────────────────────── */}
      <MapView
        style={{ flex: 1 }}
        styleURL="mapbox://styles/mapbox/outdoors-v12"
        pitchEnabled
        rotateEnabled
        compassEnabled
        attributionEnabled
        logoEnabled
        onPress={(feature) => {
          if (featureTappedRef.current) {
            featureTappedRef.current = false;
            return;
          }
          if (isReportMode) {
            const coords = (feature as GeoJSON.Feature<GeoJSON.Point>).geometry?.coordinates;
            if (coords) {
              handleMapTap({
                longitude: coords[0] as number,
                latitude: coords[1] as number,
              });
            }
          } else {
            closeAllSheets();
          }
        }}
        onCameraChanged={(state) => setZoomLevel(state.properties.zoom)}
      >
        {/* Camera */}
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: UT_CENTER,
            zoomLevel: 15,
            pitch: 45,
          }}
        />

        {/* ── Icon images for POI SymbolLayer ──────────────────────────────── */}
        <Images
          images={{
            autoDoor: require("../../assets/map_icons/auto_door.png"),
            manualDoor: require("../../assets/map_icons/manual_door.png"),
          }}
        />

        {/* ── 3D Terrain ───────────────────────────────────────────────────── */}
        <RasterDemSource
          id="mapbox-dem"
          url="mapbox://mapbox.mapbox-terrain-dem-v1"
          tileSize={512}
          maxZoomLevel={14}
        />
        <Terrain sourceID="mapbox-dem" exaggeration={1.5} />

        {/* ── Atmospheric sky ──────────────────────────────────────────────── */}
        <SkyLayer
          id="sky"
          style={{
            skyType: "atmosphere",
            skyAtmosphereSun: [0.0, 90.0],
            skyAtmosphereSunIntensity: 15,
          }}
        />

        {/* ── 3D Campus Buildings ───────────────────────────────────────────
            FillExtrusionLayer on buildings_simple.json gives 3D geometry.
            Also serves as the tap target for the BuildingBottomSheet.       */}
        <ShapeSource
          id="campus-buildings"
          shape={buildingsGeoJSON}
          onPress={(e) => {
            if (isReportMode) return;
            featureTappedRef.current = true;
            const props = e.features[0]?.properties;
            if (props) handleBuildingPress(props);
          }}
        >
          <FillExtrusionLayer
            id="campus-buildings-3d"
            minZoomLevel={MIN_ZOOM_FOR_BUILDINGS}
            maxZoomLevel={24}
            style={{
              // Warm limestone color for UT campus buildings
              fillExtrusionColor: [
                "interpolate",
                ["linear"],
                ["get", "Shape__Area"],
                0, "#D6D2C4",
                50000, "#C8C3B8",
              ],
              // Derive height from footprint area — larger footprint → taller building
              fillExtrusionHeight: [
                "interpolate",
                ["linear"],
                ["get", "Shape__Area"],
                0, 5,
                3000, 8,
                8000, 13,
                20000, 18,
                60000, 26,
                150000, 40,
              ],
              fillExtrusionBase: 0,
              fillExtrusionVerticalGradient: true,
              fillExtrusionOpacity: [
                "interpolate",
                ["linear"],
                ["zoom"],
                14, 0.6,
                17, 0.9,
              ],
            }}
          />
        </ShapeSource>

        {/* ── Sidewalk accessibility overlay (zoom ≥ 17) ───────────────────── */}
        <ShapeSource
          id="sidewalks"
          shape={sidewalksGeoJSON}
          onPress={(e) => {
            if (isReportMode) return;
            featureTappedRef.current = true;
            const feat = e.features[0];
            if (feat?.properties) {
              handleSidewalkPress({
                id: String(feat.id ?? feat.properties.OBJECTID ?? ""),
                compliant: feat.properties.compliant ?? null,
                score: feat.properties.score ?? 0,
              });
            }
          }}
        >
          <FillLayer
            id="sidewalk-fill"
            minZoomLevel={MIN_ZOOM_FOR_SIDEWALKS}
            style={{
              fillColor: [
                "match",
                ["coalesce", ["get", "compliant"], -1],
                1, "rgba(34,197,94,0.35)",
                0, "rgba(239,68,68,0.35)",
                "rgba(156,163,175,0.25)",
              ],
            }}
          />
          <LineLayer
            id="sidewalk-line"
            minZoomLevel={MIN_ZOOM_FOR_SIDEWALKS}
            style={{
              lineColor: [
                "match",
                ["coalesce", ["get", "compliant"], -1],
                1, "rgba(34,197,94,0.7)",
                0, "rgba(239,68,68,0.7)",
                "rgba(156,163,175,0.5)",
              ],
              lineWidth: 1,
            }}
          />
        </ShapeSource>

        {/* ── Avoidance areas ──────────────────────────────────────────────── */}
        <ShapeSource
          id="avoidance-areas"
          shape={avoidanceGeoJSON}
          onPress={(e) => {
            if (isReportMode) return;
            featureTappedRef.current = true;
            const id = e.features[0]?.properties?.id;
            if (id) handleAvoidanceAreaPress(id);
          }}
        >
          <FillLayer
            id="avoidance-fill"
            style={{ fillColor: "rgba(209,0,0,0.2)" }}
          />
          <LineLayer
            id="avoidance-line"
            style={{ lineColor: "rgba(209,0,0,0.6)", lineWidth: 1.5 }}
          />
        </ShapeSource>


        {/* ── Live construction zones (ArcGIS) ─────────────────────────────── */}
        <ShapeSource
          id="construction"
          shape={constructionGeoJSON}
          onPress={(e) => {
            if (isReportMode) return;
            featureTappedRef.current = true;
            const id = e.features[0]?.properties?.id as string;
            if (id) handleConstructionPress(id);
          }}
        >
          <FillLayer
            id="construction-fill"
            style={{ fillColor: "rgba(245,158,11,0.25)" }}
          />
          <LineLayer
            id="construction-line"
            style={{ lineColor: "rgba(217,119,6,0.8)", lineWidth: 2 }}
          />
        </ShapeSource>

        {/* ── Accessibility barriers (points) ──────────────────────────────── */}
        <ShapeSource
          id="barriers"
          shape={barriersGeoJSON}
          onPress={(e) => {
            if (isReportMode) return;
            featureTappedRef.current = true;
            const props = e.features[0]?.properties;
            if (props) handleBarrierPress(props);
          }}
        >
          <CircleLayer
            id="barriers-circle"
            minZoomLevel={MIN_ZOOM_FOR_BARRIERS}
            style={{
              circleColor: "#EF4444",
              circleRadius: [
                "interpolate",
                ["linear"],
                ["zoom"],
                16, 4,
                19, 8,
              ],
              circleStrokeColor: "#fff",
              circleStrokeWidth: 1.5,
              circleOpacity: 0.9,
            }}
          />
        </ShapeSource>

        {/* ── In-progress report polygon ────────────────────────────────────── */}
        {reportGeoJSON && (
          <ShapeSource id="report-shape" shape={reportGeoJSON}>
            <FillLayer
              id="report-fill"
              style={{ fillColor: "rgba(255,0,0,0.25)" }}
              filter={["==", ["geometry-type"], "Polygon"]}
            />
            <LineLayer
              id="report-line"
              style={{ lineColor: "red", lineWidth: 2 }}
            />
          </ShapeSource>
        )}

        {/* ── Report mode point markers ─────────────────────────────────────── */}
        {aaPointsReport.map((point, index) => (
          <PointAnnotation
            key={`report-point-${index}`}
            id={`report-point-${index}`}
            coordinate={[point.longitude, point.latitude]}
          >
            <Image source={mapIcons.point} style={{ width: 16, height: 16 }} />
          </PointAnnotation>
        ))}

        {clickedPoint && (
          <PointAnnotation
            key="clicked-point"
            id="clicked-point"
            coordinate={[clickedPoint.longitude, clickedPoint.latitude]}
          >
            <Image source={mapIcons.crosshair} style={{ width: 24, height: 24 }} />
          </PointAnnotation>
        )}

        {/* ── POI markers — ShapeSource+SymbolLayer for reliability ─────────── */}
        {!isReportMode && (
          <ShapeSource
            id="pois"
            shape={poiGeoJSON}
            onPress={(e) => {
              featureTappedRef.current = true;
              const id = e.features[0]?.properties?.id;
              const poi = (POIs ?? []).find((p) => String(p.id) === id);
              if (poi) handlePOIPress(poi);
            }}
          >
            <SymbolLayer
              id="poi-symbols"
              minZoomLevel={MIN_ZOOM_FOR_POIS}
              style={{
                iconImage: ["get", "icon"],
                iconSize: 0.75,
                iconAllowOverlap: true,
                iconAnchor: "bottom",
              }}
            />
          </ShapeSource>
        )}
      </MapView>

      {isReportMode ? (
        <>
          {/* Report mode overlay tint */}
          <View className="pointer-events-none absolute bottom-0 left-0 right-0 top-0 bg-ut-blue/15" />
          <ReportModal
            className="absolute left-10 right-10"
            style={{ top: insets.top + 25 }}
            aaPoints={aaPointsReport}
            currentStep={reportStep}
            setAAPoints={(points) => setAAPointsReport(points)}
            setCurrentStep={(index) => setReportStep(index)}
            onSubmit={async (data) => {
              const aaPoints = [...data.aaPoints, data.aaPoints[0]];
              await insertAvoidanceArea({
                name: data.name,
                description: data.description,
                boundary_geojson: {
                  type: "Polygon",
                  coordinates: [
                    aaPoints.map((point) => [
                      point.longitude ?? 0,
                      point.latitude ?? 0,
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
      ) : canReport ? (
        <Button
          className="absolute bottom-4 right-4"
          title="Report"
          onPress={() => setIsReportMode(true)}
        />
      ) : null}
    </>
  );
}
