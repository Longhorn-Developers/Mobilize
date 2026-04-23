import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useIsFocused } from "@react-navigation/native";
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
import * as turf from "@turf/turf";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, InteractionManager, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import AvoidanceAreaBottomSheet from "~/components/AvoidanceAreaBottomSheet";
import BarrierBottomSheet from "~/components/BarrierBottomSheet";
import { Button } from "~/components/Button";
import ConstructionBottomSheet from "~/components/ConstructionBottomSheet";
import {
  LocationDetailsBottomSheet,
  type LocationDetailsBottomSheetRef,
} from "~/components/LocationDetailsBottomSheet";
import POIBottomSheet, { POIReviewData } from "~/components/POIBottomSheet";
import ReportModal from "~/components/ReportModal";
import ReviewModal from "~/components/ReviewModal";
import { SearchBar } from "~/components/SearchBar";
import { SearchDropdown } from "~/components/SearchDropdown";
import SidewalkBottomSheet, { type SidewalkSegment } from "~/components/SidewalkBottomSheet";
import {
  usePOIs,
  useAvoidanceAreas,
  useConstructionAreas,
  useInsertAvoidanceArea,
} from "~/utils/api-hooks";
import {
  buildingToPlaceDetails,
  findBuilding,
} from "~/utils/buildingDatabase";
import { searchPlaces, getPlaceDetails } from "~/utils/mapboxSearch";
import { useTheme } from "~/utils/ThemeContext";
import { useAuth } from "~/utils/useAuth";
import useMapIcons from "~/utils/useMapIcons";

import buildingsData from "../../assets/geojson/buildings_simple.json";

// Initialise Mapbox
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "");

// ── Constants ──────────────────────────────────────────────────────────────────
const UT_CENTER: [number, number] = [-97.733, 30.282];
const MIN_ZOOM_FOR_POIS = 16;
const MIN_ZOOM_FOR_SIDEWALKS = 17;
const MIN_ZOOM_FOR_BUILDINGS = 14;
const MIN_ZOOM_FOR_BARRIERS = 16;
const MIN_ZOOM_FOR_LABELS = 15;
const MAX_ZOOM_FOR_LABELS = 17;
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

type LatLng = { latitude: number; longitude: number };
type MapDetailMode = "simple" | "detailed";

const normalizeCampusText = (value?: string | null) =>
  (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const extractBuildingAbbreviation = (value?: string | null): string | null => {
  if (!value) return null;
  const parenMatch = value.match(/\(([A-Za-z0-9]{2,8})\)/);
  if (parenMatch?.[1]) return parenMatch[1].toUpperCase();
  const leadingCodeMatch = value.match(/^([A-Za-z0-9]{2,8})\b/);
  if (leadingCodeMatch?.[1]) return leadingCodeMatch[1].toUpperCase();
  return null;
};

const isEntrancePoi = (poi: any) => {
  const poiType = String(poi?.poi_type ?? "").toLowerCase();
  return poiType.includes("entrance") && !poiType.includes("ramp");
};

// ── POI clustering ─────────────────────────────────────────────────────────────


// ──────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const insets = useSafeAreaInsets();
  const mapIcons = useMapIcons();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const isTabFocused = useIsFocused();
  const { user } = useAuth();
  const { colorScheme } = useTheme();
  const canReport =
    user?.role === "student" ||
    user?.email?.toLowerCase().endsWith("@utexas.edu") === true;
  const isDark = colorScheme === "dark";

  // ── Refs ───────────────────────────────────────────────────────────────────
  const cameraRef = useRef<Camera>(null);
  const avoidanceAreaBottomSheetRef = useRef<BottomSheetModal>(null);
  const poiBottomSheetRef = useRef<BottomSheetModal>(null);
  const reviewSheetRef = useRef<BottomSheetModal>(null);
  const locationBottomSheetRef = useRef<LocationDetailsBottomSheetRef>(null);
  const sidewalkBottomSheetRef = useRef<BottomSheetModal>(null);
  const barrierBottomSheetRef = useRef<BottomSheetModal>(null);
  const constructionBottomSheetRef = useRef<BottomSheetModal>(null);
  const featureTappedRef = useRef(false);

  // ── GeoJSON — deferred load so the app doesn't freeze on startup ───────────
  const [sidewalksGeoJSON, setSidewalksGeoJSON] = useState<GeoJSON.FeatureCollection>(EMPTY_FC);
  const [buildingsGeoJSON, setBuildingsGeoJSON] = useState<GeoJSON.FeatureCollection>(EMPTY_FC);
  const [barriersGeoJSON, setBarriersGeoJSON] = useState<GeoJSON.FeatureCollection>(EMPTY_FC);
  const [rampsGeoJSON, setRampsGeoJSON] = useState<GeoJSON.FeatureCollection>(EMPTY_FC);

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
       
      setSidewalksGeoJSON(require("../../assets/geojson/sidewalks_slim.json"));
       
      setBuildingsGeoJSON(require("../../assets/geojson/buildings_simple.json"));
       
      setBarriersGeoJSON(require("../../assets/geojson/UTA_Access_Barriers.json"));
      setRampsGeoJSON(require("../../assets/geojson/Ramps.json"));
    });
  }, []);

  // ── State ──────────────────────────────────────────────────────────────────
  const [isReportMode, setIsReportMode] = useState(false);
  const [aaPointsReport, setAAPointsReport] = useState<LatLng[]>([]);
  const [clickedPoint, setClickedPoint] = useState<LatLng | null>(null);
  const [reportStep, setReportStep] = useState(0);
  const [Route] = useState<[number, number][] | null>(null);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mapDetailMode, setMapDetailMode] = useState<MapDetailMode>("detailed");

  // Reviews
  const [reviewKey, setReviewKey] = useState(0);
  const [poi, setPoi] = useState<POIReviewData>();
  const handleSetPoi = useCallback((poi: POIReviewData | undefined) => {
    setPoi(poi);
  }, []);
  const showDetailedLayers = mapDetailMode === "detailed";

  // ── Data hooks ─────────────────────────────────────────────────────────────
  const { data: avoidanceAreas } = useAvoidanceAreas();
  const { data: constructionAreas } = useConstructionAreas();
  const { data: POIs } = usePOIs();
  const { mutateAsync: insertAvoidanceArea } = useInsertAvoidanceArea();

  // ── GeoJSON sources ────────────────────────────────────────────────────────

  const avoidanceGeoJSON = useMemo(
    (): GeoJSON.FeatureCollection => ({
      type: "FeatureCollection",
      features: (avoidanceAreas ?? []).map((area: any) => ({
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
      features: (constructionAreas ?? []).flatMap((area: any) => {
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
            properties: {
              id: `C${area.id}`,
              description: area.description ?? null,
            },
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

  const poiGeoJSON = useMemo(
    (): GeoJSON.FeatureCollection => ({
      type: "FeatureCollection",
      features: (POIs ?? [])
        .filter(isEntrancePoi)
        .map((poi) => ({
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

  // Route as GeoJSON for Mapbox LineLayer
  const routeGeoJSON = useMemo((): GeoJSON.FeatureCollection | null => {
    if (!Route || Route.length < 2) return null;
    return {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: Route },
      }],
    };
  }, [Route]);

  // ── Helper functions ───────────────────────────────────────────────────────

  const findCampusBuildingFeature = (
    latitude: number,
    longitude: number,
    placeName?: string,
    placeAddress?: string,
  ) => {
    const point = turf.point([longitude, latitude]);
    const buildingsAny = buildingsData as any;
    const features: any[] = buildingsAny.features ?? [];

    const placeAbbreviation =
      extractBuildingAbbreviation(placeName) ??
      extractBuildingAbbreviation(placeAddress);
    if (placeAbbreviation) {
      const abbreviationMatch = features.find(
        (feature) =>
          String(feature?.properties?.Building_Abbr ?? "").toUpperCase() === placeAbbreviation,
      );
      if (abbreviationMatch) {
        return abbreviationMatch;
      }
    }

    const polygonMatch = features.find((feature) =>
      feature?.geometry && turf.booleanPointInPolygon(point, feature),
    );
    if (polygonMatch) {
      return polygonMatch;
    }

    const normalizedName = normalizeCampusText(placeName);
    const normalizedAddress = normalizeCampusText(placeAddress);
    if (normalizedName || normalizedAddress) {
      const nameMatch = features.find((feature) => {
        const description = normalizeCampusText(feature?.properties?.Description);
        const abbr = normalizeCampusText(feature?.properties?.Building_Abbr);
        return (
          (normalizedName &&
            ((description && (description.includes(normalizedName) || normalizedName.includes(description))) ||
              (abbr && normalizedName.includes(abbr)))) ||
          (normalizedAddress && description && normalizedAddress.includes(description))
        );
      });
      if (nameMatch) {
        return nameMatch;
      }
    }

    let nearestFeature: any = null;
    let nearestDistanceSq = Number.POSITIVE_INFINITY;
    for (const feature of features) {
      const center = turf.centerOfMass(feature as any)?.geometry?.coordinates;
      if (!Array.isArray(center) || center.length < 2) continue;
      const dx = Number(center[0]) - longitude;
      const dy = Number(center[1]) - latitude;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearestFeature = feature;
      }
    }

    // Approx ~225m threshold to avoid snapping far away locations.
    const MAX_SNAP_DISTANCE_SQ = 0.002 * 0.002;
    return nearestDistanceSq <= MAX_SNAP_DISTANCE_SQ ? nearestFeature : null;
  };

  const isPoiInsideBuilding = (poi: any, buildingFeature: any) => {
    const coords = poi?.location_geojson?.coordinates;
    if (!coords?.length || !buildingFeature?.geometry) return false;
    const point = turf.point([Number(coords[0]), Number(coords[1])]);
    return turf.booleanPointInPolygon(point, buildingFeature as any);
  };

  const findEntrancePoiForBuilding = useCallback((buildingFeature: any) => {
    const entrances = (POIs ?? []).filter(isEntrancePoi);
    if (!entrances.length || !buildingFeature) return null;

    const buildingAbbr = String(buildingFeature?.properties?.Building_Abbr ?? "").toUpperCase();
    if (buildingAbbr) {
      const abbreviationMatch = entrances.find((entry) => {
        const entryAbbr =
          extractBuildingAbbreviation(entry?.metadata?.bld_name) ??
          extractBuildingAbbreviation(entry?.metadata?.name);
        return entryAbbr === buildingAbbr;
      });
      if (abbreviationMatch) return abbreviationMatch;
    }

    const geometryMatch = entrances.find((entry) => isPoiInsideBuilding(entry, buildingFeature));
    return geometryMatch ?? null;
  }, [POIs]);

  const buildPoiFromCampusBuilding = useCallback((
    placeDetails: any,
    buildingFeature: any,
  ) => {
    if (!buildingFeature) {
      return null;
    }

    const matchedEntrance = findEntrancePoiForBuilding(buildingFeature);
    if (matchedEntrance) {
      return matchedEntrance;
    }

    const buildingAbbr = buildingFeature?.properties?.Building_Abbr;
    const buildingName = buildingFeature?.properties?.Description;
    if (!buildingName) return null;

    const centroidCoords = turf.centerOfMass(buildingFeature as any)?.geometry?.coordinates as
      | [number, number]
      | undefined;
    const lng = placeDetails?.geometry?.location?.lng ?? centroidCoords?.[0];
    const lat = placeDetails?.geometry?.location?.lat ?? centroidCoords?.[1];
    if (lng == null || lat == null) return null;

    return {
      id: `search-${placeDetails?.place_id ?? buildingAbbr ?? buildingName}`,
      poi_type: "accessible_entrance",
      location_geojson: {
        type: "Point",
        coordinates: [lng, lat],
      },
      metadata: {
        name: buildingName,
        bld_name: buildingAbbr ? `(${buildingAbbr}) ${buildingName}` : buildingName,
      },
    };
  }, [findEntrancePoiForBuilding]);

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

  const closeAllSheets = useCallback(() => {
    avoidanceAreaBottomSheetRef.current?.dismiss();
    poiBottomSheetRef.current?.dismiss();
    sidewalkBottomSheetRef.current?.dismiss();
    locationBottomSheetRef.current?.dismiss();
    barrierBottomSheetRef.current?.dismiss();
    constructionBottomSheetRef.current?.dismiss();
    reviewSheetRef.current?.dismiss();
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        closeAllSheets();
        setPoi(undefined);
        setIsSearchActive(false);
        setSearchQuery("");
        setIsReportMode(false);
        setAAPointsReport([]);
        setClickedPoint(null);
        setReportStep(0);
      };
    }, [closeAllSheets]),
  );

  useEffect(() => {
    if (isTabFocused) return;
    closeAllSheets();
    setPoi(undefined);
    setIsSearchActive(false);
    setSearchQuery("");
    setIsReportMode(false);
    setAAPointsReport([]);
    setClickedPoint(null);
    setReportStep(0);
  }, [isTabFocused, closeAllSheets]);

  const handleAvoidanceAreaPress = (polygonId: string) => {
    const area = (avoidanceAreas ?? []).find((a: any) => String(a.id) === polygonId);
    if (!area) return;
    avoidanceAreaBottomSheetRef.current?.present({ area });
  };

  const handleSidewalkPress = (segment: SidewalkSegment) => {
    sidewalkBottomSheetRef.current?.present({ segment });
  };

  const handlePOIPress = (poi: any) => {
    poiBottomSheetRef.current?.present({ poi });
  };

  const handleBarrierPress = (properties: Record<string, any>) => {
    barrierBottomSheetRef.current?.present({ barrier: properties });
  };

  const handleConstructionPress = (id: string, description?: string) => {
    constructionBottomSheetRef.current?.present({ construction: { id, description } });
  };

  const handleRampPress = useCallback((feature: GeoJSON.Feature) => {
    if (isReportMode) return;

    const geometry = feature.geometry as GeoJSON.Point | null;
    if (!geometry || geometry.type !== "Point") return;
    const [lng, lat] = geometry.coordinates as [number, number];
    const properties = (feature.properties ?? {}) as Record<string, any>;
    const rampAreaAbbr = String(properties.Area_Description ?? "").toUpperCase();

    const features = ((buildingsData as any).features ?? []) as any[];
    const buildingMatchByAbbreviation = rampAreaAbbr
      ? features.find((entry) => String(entry?.properties?.Building_Abbr ?? "").toUpperCase() === rampAreaAbbr)
      : null;
    const buildingFeature =
      buildingMatchByAbbreviation ??
      findCampusBuildingFeature(lat, lng);
    if (!buildingFeature) return;

    const buildingPoi = buildPoiFromCampusBuilding(
      {
        place_id: `ramp-${properties.ObjectId ?? properties.GlobalID ?? feature.id ?? "unknown"}`,
        geometry: { location: { lat, lng } },
      },
      buildingFeature,
    );

    if (buildingPoi) {
      locationBottomSheetRef.current?.dismiss();
      poiBottomSheetRef.current?.present({ poi: buildingPoi });
    }
  }, [isReportMode, buildPoiFromCampusBuilding]);

  /**
   * Handle a tap on a campus building polygon using the local building database.
   */
  const handleBuildingTap = useCallback((feature: GeoJSON.Feature) => {
    if (isReportMode) return;
    const buildingPoi = buildPoiFromCampusBuilding(null, feature);
    if (buildingPoi) {
      locationBottomSheetRef.current?.dismiss();
      poiBottomSheetRef.current?.present({ poi: buildingPoi });
      return;
    }

    const props = feature.properties as { Building_Abbr?: string } | null;
    const building = props?.Building_Abbr ? findBuilding(props.Building_Abbr) : null;
    if (!building) return;
    locationBottomSheetRef.current?.present(buildingToPlaceDetails(building));
  }, [isReportMode, buildPoiFromCampusBuilding]);


  const handleSelectLocation = async (location: {
    id: string;
    name: string;
    address?: string;
    place_id?: string;
  }) => {
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

    if (resolvedPlaceId) {
      let placeDetails = null;
      let matchingBuilding: any = null;

      if (resolvedPlaceId.startsWith("local_")) {
        const building = findBuilding(resolvedPlaceId.replace(/^local_/, ""));
        if (building) {
          placeDetails = buildingToPlaceDetails(building);
          matchingBuilding =
            (buildingsData as any).features?.find(
              (feature: any) =>
                feature?.properties?.Building_Abbr === building.Building_Abbr,
            ) ?? null;
        }
      } else {
        placeDetails = await getPlaceDetails(resolvedPlaceId);

        if (placeDetails) {
          matchingBuilding = findCampusBuildingFeature(
            placeDetails.geometry.location.lat,
            placeDetails.geometry.location.lng,
            placeDetails.name,
            placeDetails.formatted_address,
          );
        }
      }

      if (placeDetails) {
        cameraRef.current?.setCamera({
          centerCoordinate: [
            placeDetails.geometry.location.lng,
            placeDetails.geometry.location.lat,
          ],
          zoomLevel: 18,
          animationDuration: 800,
        });

        const buildingPoi = buildPoiFromCampusBuilding(placeDetails, matchingBuilding);

        if (buildingPoi) {
          locationBottomSheetRef.current?.dismiss();
          poiBottomSheetRef.current?.present({ poi: buildingPoi });
        } else {
          locationBottomSheetRef.current?.present(placeDetails);
        }
      }
    } else {
      console.error("Could not resolve place_id for selected location", location);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (!isSearchActive && text.length > 0) setIsSearchActive(true);
  };

  // ── Dark-mode-aware layer styles ──────────────────────────────────────────

  const buildingExtrusionColor = isDark
    ? (["interpolate", ["linear"], ["get", "Shape__Area"], 0, "#5A5550", 50000, "#4A4540"] as any)
    : (["interpolate", ["linear"], ["get", "Shape__Area"], 0, "#D6D2C4", 50000, "#C8C3B8"] as any);

  const labelTextColor = isDark ? "#E5E7EB" : "#3D2B1F";
  const labelHaloColor = isDark ? "#1C1C1E" : "#FFFFFF";

  // ── Review mode handlers ───────────────────────────────────────────────────

  const handleEnterReviewMode = useCallback(() => {
    setReviewKey(prevKey => prevKey + 1);
    reviewSheetRef.current?.present();
  }, []);

  const handleExitReviewMode = () => {
    closeAllSheets();
    setPoi(undefined);
  };

  const emptyPOIs = useMemo(() => [], []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ title: "Home", headerShown: false }} />

      {/* Search bar — hidden in report mode */}
      {!isReportMode && (
        <SearchBar
          onPress={() => setIsSearchActive(true)}
          onChangeText={handleSearchChange}
          onClear={() => {
            setSearchQuery("");
            setIsSearchActive(false);
          }}
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
      {isTabFocused ? (
        <>
          <AvoidanceAreaBottomSheet ref={avoidanceAreaBottomSheetRef} />
          <POIBottomSheet
            ref={poiBottomSheetRef}
            allPOIs={POIs ?? emptyPOIs}
            handleReviews={handleEnterReviewMode}
            setPoi={handleSetPoi}
          />
          <SidewalkBottomSheet ref={sidewalkBottomSheetRef} />
          <LocationDetailsBottomSheet ref={locationBottomSheetRef} />
          <BarrierBottomSheet ref={barrierBottomSheetRef} />
          <ConstructionBottomSheet ref={constructionBottomSheetRef} />

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
              entranceName={poi ? poi.entrance : "No Entrance Name Found"}
              building={poi && poi.building}
              buildingName={poi ? poi.buildingName : "No Building Name Found"}
              onExit={handleExitReviewMode}
            />
          </BottomSheetModal>
        </>
      ) : null}

      {/* ── Mapbox Map ─────────────────────────────────────────────────────── */}
      <MapView
        style={{ flex: 1 }}
        styleURL={
          isDark
            ? "mapbox://styles/mapbox/dark-v11"
            : "mapbox://styles/mapbox/outdoors-v12"
        }
        pitchEnabled
        rotateEnabled
        compassEnabled
        compassViewPosition={1}
        compassViewMargins={{ x: 16, y: insets.top + 70 }}
        attributionEnabled
        logoEnabled
        onPress={(feature: any) => {
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
            setIsSearchActive(false);
            setSearchQuery("");
          }
        }}
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
            rampIcon: require("../../assets/map_icons/ramp.png"),
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

        {/* ── 3D Campus Buildings + Abbreviation Labels ────────────────────── */}
        <ShapeSource
          id="campus-buildings"
          shape={buildingsGeoJSON}
          onPress={(e: any) => {
            if (isReportMode) return;
            featureTappedRef.current = true;
            const feature = e.features[0];
            if (feature) handleBuildingTap(feature as GeoJSON.Feature);
          }}
        >
          <FillExtrusionLayer
            id="campus-buildings-3d"
            minZoomLevel={MIN_ZOOM_FOR_BUILDINGS}
            maxZoomLevel={30}
            style={{
              fillExtrusionColor: buildingExtrusionColor,
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

          {/* Building abbreviations visible at 2D zoom range */}
          <SymbolLayer
            id="campus-building-labels"
            minZoomLevel={MIN_ZOOM_FOR_LABELS}
            maxZoomLevel={MAX_ZOOM_FOR_LABELS}
            style={{
              textField: ["get", "Building_Abbr"],
              textSize: 11,
              textColor: labelTextColor,
              textHaloColor: labelHaloColor,
              textHaloWidth: 1.5,
              textAnchor: "center",
              textAllowOverlap: false,
              textIgnorePlacement: false,
              textFont: ["DIN Offc Pro Medium", "Arial Unicode MS Regular"],
            }}
          />
        </ShapeSource>

        {/* ── Sidewalk accessibility overlay (zoom ≥ 17) ───────────────────── */}
        {showDetailedLayers && (
        <ShapeSource
          id="sidewalks"
          shape={sidewalksGeoJSON}
          onPress={(e: any) => {
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
        )}

        {/* ── Avoidance areas ──────────────────────────────────────────────── */}
        <ShapeSource
          id="avoidance-areas"
          shape={avoidanceGeoJSON}
          onPress={(e: any) => {
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
          onPress={(e: any) => {
            if (isReportMode) return;
            featureTappedRef.current = true;
            const id = e.features[0]?.properties?.id as string;
            const description = e.features[0]?.properties?.description as string | undefined;
            if (id) handleConstructionPress(id, description);
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
        {showDetailedLayers && (
        <ShapeSource
          id="barriers"
          shape={barriersGeoJSON}
          onPress={(e: any) => {
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
        )}

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

        {/* ── Route overlay ────────────────────────────────────────────────── */}
        {routeGeoJSON && (
          <ShapeSource id="route-shape" shape={routeGeoJSON}>
            <LineLayer
              id="route-line"
              style={{ lineColor: "#50df49", lineWidth: 4, lineCap: "round", lineJoin: "round" }}
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

        {/* ── POI markers ──────────────────────────────────────────────────── */}
        {!isReportMode && (
          <ShapeSource
            id="pois"
            shape={poiGeoJSON}
            onPress={(e: any) => {
              featureTappedRef.current = true;
              const id = e.features[0]?.properties?.id;
              const poi = (POIs ?? []).filter(isEntrancePoi).find((p) => String(p.id) === id);
              if (poi) handlePOIPress(poi);
            }}
          >
            <SymbolLayer
              id="poi-symbols"
              minZoomLevel={MIN_ZOOM_FOR_POIS}
              style={{
                iconImage: ["get", "icon"],
                iconSize: 0.35,
                iconAllowOverlap: true,
                iconAnchor: "bottom",
              }}
            />
          </ShapeSource>
        )}

        {!isReportMode && (
          <ShapeSource
            id="ramps"
            shape={rampsGeoJSON}
            onPress={(e: any) => {
              featureTappedRef.current = true;
              const feature = e.features[0];
              if (feature) handleRampPress(feature as GeoJSON.Feature);
            }}
          >
            <SymbolLayer
              id="ramp-symbols"
              minZoomLevel={MIN_ZOOM_FOR_POIS}
              style={{
                iconImage: "rampIcon",
                iconSize: 0.22,
                iconAllowOverlap: true,
                iconAnchor: "bottom",
              }}
            />
          </ShapeSource>
        )}
      </MapView>

      {!isReportMode && (
        <View
          style={{
            position: "absolute",
            left: 16,
            bottom: 16,
            flexDirection: "row",
            borderRadius: 999,
            padding: 4,
            backgroundColor: isDark ? "rgba(28,28,30,0.92)" : "rgba(255,255,255,0.96)",
            shadowColor: "#000",
            shadowOpacity: 0.14,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}
        >
          {(["simple", "detailed"] as const).map((mode) => {
            const active = mapDetailMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                onPress={() => setMapDetailMode(mode)}
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  backgroundColor: active
                    ? "#BF5700"
                    : "transparent",
                }}
              >
                <Text
                  style={{
                    color: active ? "#FFFFFF" : isDark ? "#E5E7EB" : "#334155",
                    fontSize: 14,
                    fontWeight: "600",
                    textTransform: "capitalize",
                  }}
                >
                  {mode}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {isReportMode ? (
        <>
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
              setAAPointsReport([]);
              setReportStep(0);
            }}
          />
        </>
      ) : canReport ? (
        <Button
          className="absolute bottom-4 right-4"
          title="Report"
          onPress={() => {
            closeAllSheets();
            setIsSearchActive(false);
            setSearchQuery("");
            setIsReportMode(true);
          }}
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
          }}
        />
      ) : null}
    </>
  );
}
