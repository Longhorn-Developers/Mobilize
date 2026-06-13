/** Main map screen — Mapbox accessibility overlay, building/POI/avoidance-area tap handling, search, and all bottom sheets. Requires authenticated + onboarded user. */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useIsFocused } from "@react-navigation/native";
import Mapbox, { Camera, MapView } from "@rnmapbox/maps";
import * as turf from "@turf/turf";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager, View } from "react-native";
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
import { MapLayersRenderer } from "~/components/map/MapLayersRenderer";
import POIBottomSheet, { POIReviewData } from "~/components/POIBottomSheet";
import ReportModal from "~/components/ReportModal";
import ReviewModal from "~/components/ReviewModal";
import { SearchBar } from "~/components/SearchBar";
import { SearchDropdown } from "~/components/SearchDropdown";
import SidewalkBottomSheet, { type SidewalkSegment } from "~/components/SidewalkBottomSheet";
import { useMapOverlay } from "~/hooks/useMapOverlay";
import { useMapSearch } from "~/hooks/useMapSearch";
import { apiClient } from "~/utils/api-client";
import {
  usePOIs,
  useAvoidanceAreas,
  useConstructionAreas,
  useInsertAvoidanceArea,
} from "~/utils/api-hooks";
import {
  buildingToPlaceDetails,
  extractBuildingAbbreviation,
  findBuilding,
} from "~/utils/buildingDatabase";
import { getStoredMapDetailMode, type MapDetailMode } from "~/utils/mapPreferences";
import { useTheme } from "~/utils/ThemeContext";
import { useAuth } from "~/utils/useAuth";

import buildingsData from "../../assets/geojson/buildings_simple.json";

// Initialise Mapbox
const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
if (!mapboxToken) throw new Error("Missing EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN in .env");
Mapbox.setAccessToken(mapboxToken);

// Constants 
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

type LatLng = { latitude: number; longitude: number };
type ReviewContext = POIReviewData & { id: number };

const normalizeCampusText = (value?: string | null) =>
  (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();


const isEntrancePoi = (poi: any) => 
{
  const poiType = String(poi?.poi_type ?? "").toLowerCase();
  return poiType.includes("entrance") && !poiType.includes("ramp");
};

const isLikelyCampusCoordinate = (latitude: number, longitude: number) => 
{
  const withinBounds =
    latitude >= UT_CAMPUS_BOUNDS.low.latitude &&
    latitude <= UT_CAMPUS_BOUNDS.high.latitude &&
    longitude >= UT_CAMPUS_BOUNDS.low.longitude &&
    longitude <= UT_CAMPUS_BOUNDS.high.longitude;

  if (!withinBounds) return false;

  const point = turf.point([longitude, latitude]);
  const distanceKm = turf.distance(point, turf.point(UT_CENTER), 
  {
    units: "kilometers",
  }); // need to change this to current location once out of testing
  return Number.isFinite(distanceKm) && distanceKm <= CAMPUS_MATCH_RADIUS_KM;
};

// ── POI clustering ─────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const insets = useSafeAreaInsets();
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
  const onDismissSheetsRef = useRef<() => void>(() => {});
  const onResetUiStateRef = useRef<() => void>(() => {});
  const stableDismissSheets = useCallback(() => onDismissSheetsRef.current(), []);
  const stableResetUiState = useCallback(() => onResetUiStateRef.current(), []);

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
  const [mapDetailMode, setMapDetailMode] = useState<MapDetailMode>("detailed");
  const [, setZoomLevel] = useState(15);

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
    if (!isLikelyCampusCoordinate(latitude, longitude)) 
    {
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
    if (normalizedName) 
      {
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

  // ── Overlay + search hooks ─────────────────────────────────────────────────

  const {
    featureTappedRef,
    beginOverlayAction,
    canPresent,
    guardedPresent,
    registerAbortController,
    releaseAbortController,
    closeAllSheets,
  } = useMapOverlay({
    isTabFocused,
    onDismissSheets: stableDismissSheets,
    onResetUiState: stableResetUiState,
  });

  const {
    isSearchActive,
    setIsSearchActive,
    searchQuery,
    setSearchQuery,
    handleSearchChange,
    handleSelectLocation,
  } = useMapSearch({
    cameraRef,
    locationBottomSheetRef,
    poiBottomSheetRef,
    beginOverlayAction,
    canPresent,
    guardedPresent,
    registerAbortController,
    releaseAbortController,
    buildPoiFromCampusBuilding,
    findCampusBuildingFeature,
    isLikelyCampusCoordinate,
  });

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

  // Keep stable callback refs current each render so closeAllSheets
  // (from useMapOverlay) always calls the latest implementations.
  onDismissSheetsRef.current = () => {
    avoidanceAreaBottomSheetRef.current?.dismiss();
    poiBottomSheetRef.current?.dismiss();
    sidewalkBottomSheetRef.current?.dismiss();
    locationBottomSheetRef.current?.dismiss();
    barrierBottomSheetRef.current?.dismiss();
    constructionBottomSheetRef.current?.dismiss();
    forceCloseReview();
  };
  onResetUiStateRef.current = () => {
    setIsSearchActive(false);
    setSearchQuery("");
    setIsReportMode(false);
    setAAPointsReport([]);
    setClickedPoint(null);
    setReportStep(0);
  };

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
        compassEnabled
        compassViewPosition={1}
        compassViewMargins={{ x: 16, y: insets.top + 70 }}
        attributionEnabled
        logoEnabled
        onCameraChanged={(state) => setZoomLevel(state.properties.zoom)}
        onPress={(feature: any) => {
          if (featureTappedRef.current) 
          {
            featureTappedRef.current = false;
            return;
          }
          if (isReportMode) 
          {
            const coords = (feature as GeoJSON.Feature<GeoJSON.Point>).geometry?.coordinates;
            if (coords) 
              {
              handleMapTap({
                longitude: coords[0] as number,
                latitude: coords[1] as number,
              });
            }
          } else 
            {
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

        <MapLayersRenderer
          buildingsGeoJSON={buildingsGeoJSON}
          sidewalksGeoJSON={sidewalksGeoJSON}
          barriersGeoJSON={barriersGeoJSON}
          rampsGeoJSON={rampsGeoJSON}
          avoidanceGeoJSON={avoidanceGeoJSON}
          constructionGeoJSON={constructionGeoJSON}
          poiGeoJSON={poiGeoJSON}
          reportGeoJSON={reportGeoJSON}
          routeGeoJSON={routeGeoJSON}
          clusteredEntrancePOIs={clusteredEntrancePOIs}
          aaPointsReport={aaPointsReport}
          clickedPoint={clickedPoint}
          showDetailedLayers={showDetailedLayers}
          isReportMode={isReportMode}
          buildingExtrusionColor={buildingExtrusionColor}
          labelTextColor={labelTextColor}
          labelHaloColor={labelHaloColor}
          minZoomBuildings={MIN_ZOOM_FOR_BUILDINGS}
          minZoomPOIs={MIN_ZOOM_FOR_POIS}
          minZoomSidewalks={MIN_ZOOM_FOR_SIDEWALKS}
          minZoomBarriers={MIN_ZOOM_FOR_BARRIERS}
          minZoomLabels={MIN_ZOOM_FOR_LABELS}
          maxZoomLabels={MAX_ZOOM_FOR_LABELS}
          featureTappedRef={featureTappedRef}
          onBuildingPress={handleBuildingTap}
          onSidewalkPress={handleSidewalkPress}
          onAvoidanceAreaPress={handleAvoidanceAreaPress}
          onConstructionPress={handleConstructionPress}
          onBarrierPress={handleBarrierPress}
          onPOIPress={handlePOIPress}
          onRampPress={handleRampPress}
        />
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
