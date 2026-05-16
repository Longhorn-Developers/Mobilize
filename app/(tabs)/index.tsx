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
import { Image, InteractionManager, View } from "react-native";
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
import { apiClient } from "~/utils/api-client";
import {
  usePOIs,
  useAvoidanceAreas,
  useConstructionAreas,
  useInsertAvoidanceArea,
} from "~/utils/api-hooks";
import {
  buildingToPlaceDetails,
  findBuilding,
  searchBuildings,
} from "~/utils/buildingDatabase";
import { getPlaceDetails, searchPlaces } from "~/utils/googlePlaces";
import { getStoredMapDetailMode, type MapDetailMode } from "~/utils/mapPreferences";
import { useTheme } from "~/utils/ThemeContext";
import { useAuth } from "~/utils/useAuth";
import useMapIcons from "~/utils/useMapIcons";

import buildingsData from "../../assets/geojson/buildings_simple.json";

// Initialise Mapbox
const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
if (!mapboxToken) throw new Error("Missing EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN in .env");
Mapbox.setAccessToken(mapboxToken);

// ── Constants ──────────────────────────────────────────────────────────────────
const UT_CENTER: [number, number] = [-97.733, 30.282];
const UT_CAMPUS_BOUNDS = {
  low: { latitude: 30.269, longitude: -97.747 },
  high: { latitude: 30.295, longitude: -97.721 },
} as const;
const CAMPUS_MATCH_RADIUS_KM = 2.5;
const MIN_ZOOM_FOR_POIS = 16;
const MIN_ZOOM_FOR_SIDEWALKS = 17;
const MIN_ZOOM_FOR_BUILDINGS = 14;
const MIN_ZOOM_FOR_BARRIERS = 16;
const MIN_ZOOM_FOR_LABELS = 15;
const MAX_ZOOM_FOR_LABELS = 17;
const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
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
    visited.add(i);

    const group = [pois[i]];

    // Keep expanding until no new members are added
    let changed = true;
    while (changed) {
      changed = false;

      // Recompute centroid of current group
      const centroid = turf.centroid(
        turf.multiPoint(group.map((p) => [
          p.location_geojson.coordinates[0],
          p.location_geojson.coordinates[1],
        ]))
      );

      for (let j = 0; j < pois.length; j++) {
        if (visited.has(j)) continue;
        if (getPOISubtype(pois[j]) !== getPOISubtype(group[0])) continue;

        const dist = turf.distance(
          centroid,
          turf.point([
            pois[j].location_geojson.coordinates[0],
            pois[j].location_geojson.coordinates[1],
          ]),
          { units: "meters" }
        );

        if (dist <= CLUSTER_RADIUS) {
          group.push(pois[j]);
          visited.add(j);
          changed = true;
        }
      }
    }

    if (group.length === 1) {
      clusters.push(group[0]);
    } else {
      const centroid = turf.centroid(
        turf.multiPoint(group.map((p) => [
          p.location_geojson.coordinates[0],
          p.location_geojson.coordinates[1],
        ]))
      );
      clusters.push({
        ...group[0],
        location_geojson: {
          ...group[0].location_geojson,
          coordinates: centroid.geometry.coordinates,
        },
        clusteredPOIs: group,
      });
    }
  }

  return clusters;
}

type LatLng = { latitude: number; longitude: number };
type ReviewContext = POIReviewData & { id: number };

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

const looksLikeCampusAbbreviation = (query: string) => {
  const normalized = query.trim().toUpperCase();
  return /^[A-Z0-9]{2,6}$/.test(normalized);
};

const isEntrancePoi = (poi: any) => {
  const poiType = String(poi?.poi_type ?? "").toLowerCase();
  return poiType.includes("entrance") && !poiType.includes("ramp");
};

const isLikelyCampusCoordinate = (latitude: number, longitude: number) => {
  const withinBounds =
    latitude >= UT_CAMPUS_BOUNDS.low.latitude &&
    latitude <= UT_CAMPUS_BOUNDS.high.latitude &&
    longitude >= UT_CAMPUS_BOUNDS.low.longitude &&
    longitude <= UT_CAMPUS_BOUNDS.high.longitude;

  if (!withinBounds) return false;

  const point = turf.point([longitude, latitude]);
  const distanceKm = turf.distance(point, turf.point(UT_CENTER), {
    units: "kilometers",
  });
  return Number.isFinite(distanceKm) && distanceKm <= CAMPUS_MATCH_RADIUS_KM;
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
  const overlayEpochRef = useRef(0);
  const isScreenActiveRef = useRef(isTabFocused);
  const isClosingRef = useRef(false);
  const overlayResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllersRef = useRef<Set<AbortController>>(new Set());

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
  const [zoomLevel, setZoomLevel] = useState(15);

  // Reviews
  const [reviewKey, setReviewKey] = useState(0);
  const [reviewContext, setReviewContext] = useState<ReviewContext | null>(null);
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

  const clusteredEntrancePOIs = useMemo(
    () => clusterPOIs((POIs ?? []).filter(isEntrancePoi)),
    [POIs]
  );
  
  const poiGeoJSON = useMemo((): GeoJSON.FeatureCollection => ({
    type: "FeatureCollection",
    features: clusteredEntrancePOIs.map((poi) => ({  // ← use clustered
      type: "Feature" as const,
      id: String(poi.id),
      properties: {
        id: String(poi.id),
        icon: poi.metadata?.auto_opene ? "autoDoor" : "manualDoor",
        clusterCount: poi.clusteredPOIs?.length ?? 1,
      },
      geometry: poi.location_geojson as GeoJSON.Geometry,
    })),
  }), [clusteredEntrancePOIs]);

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
    if (!isLikelyCampusCoordinate(latitude, longitude)) {
      return null;
    }

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
    if (normalizedName) {
      const nameMatch = features.find((feature) => {
        const description = normalizeCampusText(feature?.properties?.Description);
        const abbr = normalizeCampusText(feature?.properties?.Building_Abbr);
        return (
          (description &&
            (description.includes(normalizedName) || normalizedName.includes(description))) ||
          (abbr && normalizedName.includes(abbr))
        );
      });
      if (nameMatch) {
        return nameMatch;
      }
    }

    return null;
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

  const beginOverlayAction = useCallback(() => overlayEpochRef.current, []);

  const canPresent = useCallback((epoch: number) => {
    return (
      isScreenActiveRef.current &&
      !isClosingRef.current &&
      epoch === overlayEpochRef.current
    );
  }, []);

  const registerAbortController = useCallback(() => {
    const controller = new AbortController();
    abortControllersRef.current.add(controller);
    return controller;
  }, []);

  const releaseAbortController = useCallback((controller: AbortController) => {
    abortControllersRef.current.delete(controller);
  }, []);

  const abortAllPendingActions = useCallback(() => {
    abortControllersRef.current.forEach((controller) => {
      try {
        controller.abort();
      } catch {
        // Ignore individual abort failures.
      }
    });
    abortControllersRef.current.clear();
  }, []);

  const guardedPresent = useCallback(
    (epoch: number, presentFn: () => void, actionName: string) => {
      if (!canPresent(epoch)) {
        if (__DEV__) {
          console.log(
            `[overlay] open_blocked_stale action=${actionName} epoch=${epoch} current=${overlayEpochRef.current}`,
          );
        }
        return false;
      }
      presentFn();
      if (__DEV__) {
        console.log(
          `[overlay] open_attempt action=${actionName} epoch=${epoch}`,
        );
      }
      return true;
    },
    [canPresent],
  );

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

  const forceCloseReview = useCallback(() => {
    (reviewSheetRef.current as any)?.dismiss?.();
    (reviewSheetRef.current as any)?.close?.();
    setReviewContext(null);
    setReviewKey((prevKey) => prevKey + 1);
  }, []);

  const closeAllSheets = useCallback(() => {
    overlayEpochRef.current += 1;
    isClosingRef.current = true;
    abortAllPendingActions();
    if (overlayResetTimerRef.current) {
      clearTimeout(overlayResetTimerRef.current);
      overlayResetTimerRef.current = null;
    }

    avoidanceAreaBottomSheetRef.current?.dismiss();
    poiBottomSheetRef.current?.dismiss();
    sidewalkBottomSheetRef.current?.dismiss();
    locationBottomSheetRef.current?.dismiss();
    barrierBottomSheetRef.current?.dismiss();
    constructionBottomSheetRef.current?.dismiss();
    forceCloseReview();
    setIsSearchActive(false);
    setSearchQuery("");
    setIsReportMode(false);
    setAAPointsReport([]);
    setClickedPoint(null);
    setReportStep(0);

    if (__DEV__) {
      console.log(`[overlay] closed_all epoch=${overlayEpochRef.current}`);
    }

    overlayResetTimerRef.current = setTimeout(() => {
      isClosingRef.current = false;
      overlayResetTimerRef.current = null;
    }, 220);
  }, [abortAllPendingActions, forceCloseReview]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getStoredMapDetailMode().then((mode) => {
        if (active) {
          setMapDetailMode(mode);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      isScreenActiveRef.current = true;
      isClosingRef.current = false;
      return () => {
        isScreenActiveRef.current = false;
        closeAllSheets();
      };
    }, [closeAllSheets]),
  );

  useEffect(() => {
    isScreenActiveRef.current = isTabFocused;
    if (isTabFocused) return;
    closeAllSheets();
  }, [isTabFocused, closeAllSheets]);

  useEffect(() => {
    return () => {
      if (overlayResetTimerRef.current) {
        clearTimeout(overlayResetTimerRef.current);
      }
      abortAllPendingActions();
      isScreenActiveRef.current = false;
    };
  }, [abortAllPendingActions]);

  const handleAvoidanceAreaPress = (polygonId: string) => {
    const area = (avoidanceAreas ?? []).find((a: any) => String(a.id) === polygonId);
    if (!area) return;
    const epoch = beginOverlayAction();
    guardedPresent(
      epoch,
      () => avoidanceAreaBottomSheetRef.current?.present({ area }),
      "avoidance_area",
    );
  };

  const handleSidewalkPress = (segment: SidewalkSegment) => {
    const epoch = beginOverlayAction();
    guardedPresent(
      epoch,
      () => sidewalkBottomSheetRef.current?.present({ segment }),
      "sidewalk",
    );
  };

  const handlePOIPress = (poi: any) => {
    const epoch = beginOverlayAction();
    guardedPresent(epoch, () => poiBottomSheetRef.current?.present({ poi }), "poi");
  };

  const handleBarrierPress = (properties: Record<string, any>) => {
    const epoch = beginOverlayAction();
    guardedPresent(
      epoch,
      () => barrierBottomSheetRef.current?.present({ barrier: properties }),
      "barrier",
    );
  };

  const handleConstructionPress = (id: string, description?: string) => {
    const epoch = beginOverlayAction();
    guardedPresent(
      epoch,
      () => constructionBottomSheetRef.current?.present({ construction: { id, description } }),
      "construction",
    );
  };

  const handleRampPress = useCallback((feature: GeoJSON.Feature) => {
    if (isReportMode) return;
    const epoch = beginOverlayAction();
    if (!canPresent(epoch)) return;

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
    if (!buildingFeature) {
      Toast.show({
        type: "error",
        text2: "Ramp is not linked to a known building yet, so reviews are unavailable for this point.",
        position: "bottom",
        bottomOffset: bottomTabBarHeight + 50,
      });
      return;
    }

    const buildingAbbr = String(buildingFeature?.properties?.Building_Abbr ?? "").trim();
    const buildingName = String(buildingFeature?.properties?.Description ?? "").trim();
    const externalKey = String(
      properties.ObjectId ??
      properties.OBJECTID ??
      properties.GlobalID ??
      feature.id ??
      `${lng},${lat}`,
    ).trim();

    const controller = registerAbortController();
    void (async () => {
      let rampPoiId: number | null = null;
      try {
        if (controller.signal.aborted || !canPresent(epoch)) return;
        const resolvedPoi = await apiClient.resolveRampPOI({
          externalKey,
          latitude: lat,
          longitude: lng,
          buildingAbbr: buildingAbbr || undefined,
          buildingName: buildingName || undefined,
        });
        if (controller.signal.aborted || !canPresent(epoch)) return;
        rampPoiId = Number(resolvedPoi?.id);
      } catch (error) {
        console.warn("Could not resolve ramp POI id:", error);
        if (controller.signal.aborted || !canPresent(epoch)) return;
      }

      const buildingPoi = buildPoiFromCampusBuilding(
        {
          place_id: `ramp-${externalKey}`,
          geometry: { location: { lat, lng } },
          name: buildingName || "Ramp Access",
          formatted_address: "UT Campus",
        },
        buildingFeature,
      );

      const rampPoi = {
        id: Number.isFinite(rampPoiId) ? (rampPoiId as number) : null,
        poi_type: "ramp",
        location_geojson: {
          type: "Point",
          coordinates: [lng, lat],
        },
        metadata: {
          name: "Ramp Access",
          bld_name: buildingName || "UT Building",
          building_name: buildingName || null,
          building_abbr: buildingAbbr || null,
          external_key: externalKey,
          ramp: true,
        },
      };

      if (controller.signal.aborted || !canPresent(epoch)) return;
      if (!rampPoi.id && buildingPoi) {
        guardedPresent(
          epoch,
          () => {
            locationBottomSheetRef.current?.dismiss();
            poiBottomSheetRef.current?.present({ poi: buildingPoi });
          },
          "ramp_to_building_poi",
        );
        return;
      }
      if (!rampPoi.id) return;

      guardedPresent(
        epoch,
        () => {
          locationBottomSheetRef.current?.dismiss();
          poiBottomSheetRef.current?.present({ poi: rampPoi });
        },
        "ramp_to_ramp_poi",
      );
    })().finally(() => {
      releaseAbortController(controller);
    });
  }, [
    isReportMode,
    beginOverlayAction,
    canPresent,
    buildPoiFromCampusBuilding,
    bottomTabBarHeight,
    guardedPresent,
    registerAbortController,
    releaseAbortController,
  ]);

  /**
   * Handle a tap on a campus building polygon using the local building database.
   */
  const handleBuildingTap = useCallback((feature: GeoJSON.Feature) => {
    if (isReportMode) return;
    const epoch = beginOverlayAction();
    if (!canPresent(epoch)) return;
    const buildingPoi = buildPoiFromCampusBuilding(null, feature);
    if (buildingPoi) {
      guardedPresent(
        epoch,
        () => {
          locationBottomSheetRef.current?.dismiss();
          poiBottomSheetRef.current?.present({ poi: buildingPoi });
        },
        "building_to_poi",
      );
      return;
    }

    const props = feature.properties as { Building_Abbr?: string } | null;
    const building = props?.Building_Abbr ? findBuilding(props.Building_Abbr) : null;
    if (!building) return;
    guardedPresent(
      epoch,
      () => locationBottomSheetRef.current?.present(buildingToPlaceDetails(building)),
      "building_to_location",
    );
  }, [isReportMode, beginOverlayAction, canPresent, buildPoiFromCampusBuilding, guardedPresent]);


  const handleSelectLocation = async (location: {
    id: string;
    name: string;
    address?: string;
    place_id?: string;
  }) => {
    const epoch = beginOverlayAction();
    if (!canPresent(epoch)) return;
    const controller = registerAbortController();

    // Close search
    setIsSearchActive(false);
    setSearchQuery("");

    try {
      // Resolve missing place_id for recent/manual locations so recenter still works.
      let resolvedPlaceId = location.place_id;
      if (!resolvedPlaceId) {
        const primaryQuery = [location.name, location.address].filter(Boolean).join(" ");
        const fallbackQuery = location.name;

        const resolvePlaceIdWithScopeFallback = async (queryText: string) => {
          if (!queryText.trim()) return undefined;

          const likelyCampusIntent =
            searchBuildings(queryText, 1).length > 0 ||
            looksLikeCampusAbbreviation(queryText);

          if (likelyCampusIntent) {
            const campusResults = await searchPlaces(queryText, { scope: "campus" });
            if (controller.signal.aborted || !canPresent(epoch)) return undefined;
            if (campusResults[0]?.place_id) return campusResults[0].place_id;

            const globalResults = await searchPlaces(queryText, { scope: "global" });
            if (controller.signal.aborted || !canPresent(epoch)) return undefined;
            return globalResults[0]?.place_id;
          }

          const globalResults = await searchPlaces(queryText, { scope: "global" });
          if (controller.signal.aborted || !canPresent(epoch)) return undefined;
          if (globalResults[0]?.place_id) return globalResults[0].place_id;

          const campusResults = await searchPlaces(queryText, { scope: "campus" });
          if (controller.signal.aborted || !canPresent(epoch)) return undefined;
          return campusResults[0]?.place_id;
        };

        resolvedPlaceId = await resolvePlaceIdWithScopeFallback(primaryQuery);

        if (!resolvedPlaceId && fallbackQuery) {
          resolvedPlaceId = await resolvePlaceIdWithScopeFallback(fallbackQuery);
        }
      }

      if (!resolvedPlaceId) {
        console.error("Could not resolve place_id for selected location", location);
        return;
      }

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
        placeDetails = await getPlaceDetails(
          resolvedPlaceId,
          location.name,
        );
        if (controller.signal.aborted || !canPresent(epoch)) return;

        if (placeDetails) {
          const latitude = placeDetails.geometry.location.lat;
          const longitude = placeDetails.geometry.location.lng;
          if (isLikelyCampusCoordinate(latitude, longitude)) {
            matchingBuilding = findCampusBuildingFeature(
              latitude,
              longitude,
              placeDetails.name,
              placeDetails.formatted_address,
            );
          }
        }
      }

      if (!placeDetails || controller.signal.aborted || !canPresent(epoch)) return;

      cameraRef.current?.setCamera({
        centerCoordinate: [
          placeDetails.geometry.location.lng,
          placeDetails.geometry.location.lat,
        ],
        zoomLevel: 18,
        animationDuration: 800,
      });

      const buildingPoi = buildPoiFromCampusBuilding(placeDetails, matchingBuilding);
      if (controller.signal.aborted || !canPresent(epoch)) return;

      if (buildingPoi) {
        guardedPresent(
          epoch,
          () => {
            locationBottomSheetRef.current?.dismiss();
            poiBottomSheetRef.current?.present({ poi: buildingPoi });
          },
          "search_to_poi",
        );
      } else {
        guardedPresent(
          epoch,
          () => locationBottomSheetRef.current?.present(placeDetails),
          "search_to_location",
        );
      }
    } finally {
      releaseAbortController(controller);
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

  const handleEnterReviewMode = useCallback((reviewData: POIReviewData) => {
    const epoch = beginOverlayAction();
    if (!canPresent(epoch)) return;
    const normalizedPoiId = Number(reviewData?.id);
    const hasValidPoiId =
      Number.isFinite(normalizedPoiId) &&
      Number.isInteger(normalizedPoiId) &&
      normalizedPoiId > 0;

    if (!hasValidPoiId) {
      forceCloseReview();
      Toast.show({
        type: "error",
        text2: "This location cannot be reviewed yet because it does not map to a valid campus entrance.",
        position: "bottom",
        bottomOffset: bottomTabBarHeight + 50,
      });
      return;
    }

    if (!reviewData.building || !reviewData.buildingName || reviewData.buildingName === "Unknown Building") {
      forceCloseReview();
      Toast.show({
        type: "error",
        text2: "We could not identify this building yet, so reviews are temporarily unavailable.",
        position: "bottom",
        bottomOffset: bottomTabBarHeight + 50,
      });
      return;
    }

    const nextContext: ReviewContext = {
      ...reviewData,
      id: normalizedPoiId,
    };

    setReviewContext(nextContext);
    setReviewKey((prevKey) => prevKey + 1);
    guardedPresent(epoch, () => reviewSheetRef.current?.present(), "review_open");
  }, [
    beginOverlayAction,
    canPresent,
    bottomTabBarHeight,
    forceCloseReview,
    guardedPresent,
  ]);

  const handleExitReviewMode = useCallback(() => {
    forceCloseReview();
  }, [forceCloseReview]);

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
            onDismiss={() => {
              setReviewContext(null);
            }}
          >
            {reviewContext ? (
              <ReviewModal
                key={reviewKey}
                className=""
                poi_id={reviewContext.id}
                entrances={reviewContext.entrances}
                entranceName={reviewContext.entrance}
                building={reviewContext.building}
                buildingName={reviewContext.buildingName}
                onExit={handleExitReviewMode}
              />
            ) : null}
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
        // compassEnabled /* Disabled for now, not sure of how it looks */
        compassViewPosition={1}
        compassViewMargins={{ x: 16, y: insets.top + 70 }}
        attributionEnabled
        logoEnabled
        onCameraChanged={(state) => setZoomLevel(state.properties.zoom)}
        compassEnabled={false}
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
              const poi = clusteredEntrancePOIs.find((p) => String(p.id) === id);
              if (poi) handlePOIPress(poi);
            }}
          >
            <SymbolLayer
              id="poi-symbols"
              minZoomLevel={MIN_ZOOM_FOR_POIS}
              style={{
                iconImage: ["get", "icon"],
                iconSize: [
                  "interpolate", ["linear"], ["zoom"],
                  14, 0.15,
                  16, 0.25,
                  18, 0.40,
                  20, 0.60,
                ],
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
                iconSize: [
                  "interpolate", ["linear"], ["zoom"],
                  14, 0.15,
                  16, 0.25,
                  18, 0.40,
                  20, 0.60,
                ],
                iconAllowOverlap: true,
                iconAnchor: "bottom",
              }}
            />
          </ShapeSource>
        )}
      </MapView>

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
