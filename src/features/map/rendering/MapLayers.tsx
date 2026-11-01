// Main mapbox map layer

import {
  CircleLayer,
  FillExtrusionLayer,
  FillLayer,
  LineLayer,
  PointAnnotation,
  RasterDemSource,
  ShapeSource,
  SkyLayer,
  SymbolLayer,
  Terrain,
  Camera,
} from "@rnmapbox/maps";
import * as GeoLocation from 'expo-location';
import { DeviceMotionMeasurement } from 'expo-sensors';
import { useMemo } from "react";
import { Image } from "react-native";

import { type SidewalkSegment } from "~/src/features/components/SidewalkBottomSheet";
import { type getBuildingStyles } from "~/src/features/map/buildingStyles";
import * as MapConstants from "~/src/features/map/constants";
import {
  type EntranceFilterKey,
  getDoorLayerFilter,
  isRampLayerVisible,
} from "~/src/features/map/filters/entranceFilters";
import AvoidanceAreas from "~/src/features/map/layers/avoidanceAreas";
import ConstructionZones from "~/src/features/map/layers/constructionZones";
import SidewalkLayer from "~/src/features/map/layers/sidewalks";
import UserNavigation from "~/src/features/map/layers/userNavigation";



type MapLayersProps = {
  // GeoJSON
  buildingsGeoJSON: GeoJSON.FeatureCollection;
  sidewalksGeoJSON: GeoJSON.FeatureCollection;
  barriersGeoJSON: GeoJSON.FeatureCollection;
  rampsGeoJSON: GeoJSON.FeatureCollection;
  avoidanceGeoJSON: GeoJSON.FeatureCollection;
  constructionGeoJSON: GeoJSON.FeatureCollection;
  poiGeoJSON: GeoJSON.FeatureCollection;
  reportGeoJSON: GeoJSON.FeatureCollection | null;
  routeGeoJSON?: GeoJSON.FeatureCollection | null;

  // display state
  showDetailedLayers: boolean;
  isReportMode: boolean;
  isPOIReportMode: boolean;
  aaPointsReport: { latitude: number; longitude: number }[];
  clickedPoint: { latitude: number; longitude: number } | null;
  clusteredEntrancePOIs: any[];
  buildingStyles: ReturnType<typeof getBuildingStyles>;
  mapIcons: { point: any; crosshair: any; autoDoor?: any };
  cameraState: any;
  highlightedEntrance?: [number, number] | null;
  /** Entrance types to show. Empty = no filter (show every entrance symbol). */
  selectedEntranceFilters: readonly EntranceFilterKey[];

  // external data
  geoLocation: GeoLocation.LocationObject | null;
  deviceMotion: DeviceMotionMeasurement | null;

  // handlers
  onBuildingPress: (feature: GeoJSON.Feature) => void;
  onSidewalkPress: (segment: SidewalkSegment) => void;
  onAvoidanceAreaPress: (id: string) => void;
  onConstructionPress: (id: string, description?: string) => void;
  onBarrierPress: (properties: Record<string, any>) => void;
  onPOIPress: (poi: any) => void;
  onRampPress: (feature: GeoJSON.Feature) => void;
  onFeatureTapped: () => void;
};

// ── Entrance highlight ───────────────────────────────────────────────────────────
// A soft, static halo drawn behind the icon of the entrance selected in the POI sheet.
// Tweak these to taste.
const HALO_COLOR = "#BF5700";
const HALO_OPACITY = 0.4;       // brighter
const HALO_BLUR = 0.4;          // slightly tighter
const HALO_RADIUS_FACTOR = 0.45; // smaller

const FALLBACK_ICON_PX = 96;

const ICON_SIZE_STOPS: [number, number][] = [
  [14, 0.15],
  [16, 0.25],
  [18, 0.4],
  [20, 0.6],
];
const byIconScale = (fn: (scale: number) => any): any[] => [
  "interpolate",
  ["linear"],
  ["zoom"],
  ...ICON_SIZE_STOPS.flatMap(([zoom, scale]) => [zoom, fn(scale)]),
];

function buildHaloStyle(iconSource: any) {
  let width = FALLBACK_ICON_PX;
  let height = FALLBACK_ICON_PX;
  try {
    const asset = iconSource ? Image.resolveAssetSource(iconSource) : null;
    if (asset?.width && asset?.height) {
      width = asset.width;
      height = asset.height;
    }
  } catch {
    // keep the fallback size
  }
  const side = Math.max(width, height);

  return {
    circleColor: HALO_COLOR,
    circleOpacity: HALO_OPACITY,
    circleBlur: 0.35,
  
    // Smaller halo
    circleRadius: byIconScale(
      (s) => side * s * 0.45
    ),
  
    // Move halo upward to compensate for bottom-anchored icon
    circleTranslate: byIconScale(
      (s) => ["literal", [0, -(height * s * 0.5)-15]]
    ),
  
    circleTranslateAnchor: "viewport",
  };
}

const EMPTY_FEATURES: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function EntranceHighlight({
  coordinate,
  iconSource,
}: {
  coordinate: [number, number] | null;
  iconSource?: any;
}) {
  const lng = coordinate ? coordinate[0] : null;
  const lat = coordinate ? coordinate[1] : null;

  const shape = useMemo<GeoJSON.FeatureCollection>(
    () =>
      lng == null || lat == null
        ? EMPTY_FEATURES
        : {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "Point", coordinates: [lng, lat] },
              },
            ],
          },
    [lng, lat],
  );

  const haloStyle = useMemo(() => buildHaloStyle(iconSource), [iconSource]);

  return (
    <ShapeSource id="entrance-highlight" shape={shape}>
      <CircleLayer
        id="entrance-highlight-halo"
        minZoomLevel={MapConstants.MIN_ZOOM_FOR_POIS}
        style={haloStyle as any}
      />
    </ShapeSource>
  );
}

export function MapLayers({
  buildingsGeoJSON,
  sidewalksGeoJSON,
  barriersGeoJSON,
  rampsGeoJSON,
  avoidanceGeoJSON,
  constructionGeoJSON,
  poiGeoJSON,
  reportGeoJSON,
  routeGeoJSON,
  showDetailedLayers,
  isReportMode,
  isPOIReportMode,
  aaPointsReport,
  clickedPoint,
  clusteredEntrancePOIs,
  buildingStyles,
  mapIcons,
  cameraState,
  highlightedEntrance,
  selectedEntranceFilters,
  geoLocation,
  deviceMotion,
  onBuildingPress,
  onSidewalkPress,
  onAvoidanceAreaPress,
  onConstructionPress,
  onBarrierPress,
  onPOIPress,
  onRampPress,
  onFeatureTapped,
}: MapLayersProps) {
  const { buildingExtrusionColor, labelTextColor, labelHaloColor } = buildingStyles;

  // Entrance-type filter: filters the door symbols and shows/hides the ramp symbols. Filtered-out
  // symbols aren't rendered, so they can't be tapped either.
  const doorFilter = useMemo(
    () => getDoorLayerFilter(selectedEntranceFilters),
    [selectedEntranceFilters],
  );
  const showRamps = isRampLayerVisible(selectedEntranceFilters);

  return (
    <>
      <RasterDemSource
        id="mapbox-dem"
        url="mapbox://mapbox.mapbox-terrain-dem-v1"
        tileSize={512}
        maxZoomLevel={14}
      />
      <Terrain sourceID="mapbox-dem" exaggeration={1.5} />
      <SkyLayer
        id="sky"
        style={{
          skyType: "atmosphere",
          skyAtmosphereSun: [0.0, 90.0],
          skyAtmosphereSunIntensity: 15,
        }}
      />

      {/* Custom buliding layer w/abbreviations */}
      <ShapeSource
        id="campus-buildings"
        shape={buildingsGeoJSON}
        onPress={(e: any) => {
          if (isReportMode || isPOIReportMode) return;
          onFeatureTapped();
          const feature = e.features[0];
          if (feature) onBuildingPress(feature as GeoJSON.Feature);
        }}
      >
        <FillExtrusionLayer
          id="campus-buildings-3d"
          minZoomLevel={MapConstants.MIN_ZOOM_FOR_BUILDINGS}
          maxZoomLevel={30}
          style={{
            fillExtrusionColor: buildingExtrusionColor,
            fillExtrusionHeight: [
              "interpolate", ["linear"], ["get", "Shape__Area"],
              0, 5, 3000, 8, 8000, 13, 20000, 18, 60000, 26, 150000, 40,
            ],
            fillExtrusionBase: 0,
            fillExtrusionVerticalGradient: true,
            fillExtrusionOpacity: [
              "interpolate", ["linear"], ["zoom"],
              14, 0.6, 17, 0.9,
            ],
          }}
        />

        <SymbolLayer
          id="campus-building-labels"
          minZoomLevel={MapConstants.MIN_ZOOM_FOR_LABELS}
          maxZoomLevel={MapConstants.MAX_ZOOM_FOR_LABELS}
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

      <SidewalkLayer
        geojson={sidewalksGeoJSON}
        visible={showDetailedLayers}
        isReportMode={isReportMode || isPOIReportMode}
        onPress={onSidewalkPress}
      />

      <AvoidanceAreas
        geojson={avoidanceGeoJSON}
        isReportMode={isReportMode || isPOIReportMode}
        onPress={onAvoidanceAreaPress}
        onFeatureTap={onFeatureTapped}
      />

      <ConstructionZones
        geojson={constructionGeoJSON}
        isReportMode={isReportMode || isPOIReportMode}
        onPress={onConstructionPress}
        onFeatureTap={onFeatureTapped}
      />

      {showDetailedLayers && (
        <ShapeSource
          id="barriers"
          shape={barriersGeoJSON}
          onPress={(e: any) => {
            if (isReportMode || isPOIReportMode) return;
            onFeatureTapped();
            const props = e.features[0]?.properties;
            if (props) onBarrierPress(props);
          }}
        >
          <CircleLayer
            id="barriers-circle"
            minZoomLevel={MapConstants.MIN_ZOOM_FOR_BARRIERS}
            style={{
              circleColor: "#EF4444",
              circleRadius: ["interpolate", ["linear"], ["zoom"], 16, 4, 19, 8],
              circleStrokeColor: "#fff",
              circleStrokeWidth: 1.5,
              circleOpacity: 0.9,
            }}
          />
        </ShapeSource>
      )}

      {/* In-progress report polygon */}
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

      {/* Report mode point markers */}
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

      {/* User location and direction */}
      <UserNavigation
        cameraState={cameraState}
        geoLocation={geoLocation}
        deviceMotion={deviceMotion}
      />

      {/* Selected entrance highlight. Always mounted so its layer keeps its place underneath the
          POI/ramp icons; it simply draws nothing while there is no coordinate. */}
      <EntranceHighlight
        coordinate={isReportMode || isPOIReportMode ? null : (highlightedEntrance ?? null)}
        iconSource={mapIcons.autoDoor}
      />


      {/* POI markers */}
      {!isReportMode && !isPOIReportMode && (
        <ShapeSource
          id="pois"
          shape={poiGeoJSON}
          onPress={(e: any) => {
            onFeatureTapped();
            const id = e.features[0]?.properties?.id;
            const poi = clusteredEntrancePOIs.find((p) => String(p.id) === id);
            if (poi) onPOIPress(poi);
          }}
        >
          <SymbolLayer
            id="poi-symbols"
            minZoomLevel={MapConstants.MIN_ZOOM_FOR_POIS}
            filter={doorFilter}
            style={{
              iconImage: ["get", "icon"],
              iconSize: [
                "interpolate", ["linear"], ["zoom"],
                14, 0.15, 16, 0.25, 18, 0.40, 20, 0.60,
              ],
              iconAllowOverlap: true,
              iconAnchor: "bottom",
            }}
          />
        </ShapeSource>
      )}

      {/* Ramp markers */}
      {!isReportMode && !isPOIReportMode && (
        <ShapeSource
          id="ramps"
          shape={rampsGeoJSON}
          onPress={(e: any) => {
            onFeatureTapped();
            const feature = e.features[0];
            if (feature) onRampPress(feature as GeoJSON.Feature);
          }}
        >
          <SymbolLayer
            id="ramp-symbols"
            minZoomLevel={MapConstants.MIN_ZOOM_FOR_POIS}
            style={{
              // Always set explicitly (never omitted) so toggling back to "visible" takes effect
              visibility: showRamps ? "visible" : "none",
              iconImage: "rampIcon",
              iconSize: [
                "interpolate", ["linear"], ["zoom"],
                14, 0.15, 16, 0.25, 18, 0.40, 20, 0.60,
              ],
              iconAllowOverlap: true,
              iconAnchor: "bottom",
            }}
          />
        </ShapeSource>
      )}

      {/* Navigation / preview route with directional arrows */}
      {routeGeoJSON && (
        <ShapeSource id="nav-route" shape={routeGeoJSON}>
          <LineLayer
            id="nav-route-casing"
            style={{
              lineColor: "#FFFFFF",
              lineWidth: 10,
              lineJoin: "round",
              lineCap: "round",
              lineOpacity: 0.9,
            }}
          />
          <LineLayer
            id="nav-route-fill"
            style={{
              lineColor: "#BF5700",
              lineWidth: 6,
              lineJoin: "round",
              lineCap: "round",
            }}
          />
          <SymbolLayer
            id="nav-route-arrows"
            style={{
              symbolPlacement: "line",
              symbolSpacing: 180,
              textField: "▶",
              textSize: 13,
              textColor: "#FFFFFF",
              textRotationAlignment: "map",
              textKeepUpright: false,
              textAllowOverlap: true,
              textIgnorePlacement: true,
            }}
          />
        </ShapeSource>
      )}
    </>
  );
}