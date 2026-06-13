/**
 * Renders all Mapbox ShapeSource / Layer declarations for the campus accessibility map.
 * Separated from the map screen to keep the orchestration component readable.
 * Receives pre-computed GeoJSON and press handlers as props — no data fetching here.
 */
import {
  CircleLayer,
  FillExtrusionLayer,
  FillLayer,
  Images,
  LineLayer,
  PointAnnotation,
  RasterDemSource,
  ShapeSource,
  SkyLayer,
  SymbolLayer,
  Terrain,
} from "@rnmapbox/maps";
import type { RefObject } from "react";
import { Image } from "react-native";

import type { SidewalkSegment } from "~/components/SidewalkBottomSheet";
import { mapIcons } from "~/utils/useMapIcons";

type LatLng = { latitude: number; longitude: number };

type MapLayersRendererProps = {
  // ── data ────────────────────────────────────────────────────────────────────
  buildingsGeoJSON: GeoJSON.FeatureCollection;
  sidewalksGeoJSON: GeoJSON.FeatureCollection;
  barriersGeoJSON: GeoJSON.FeatureCollection;
  rampsGeoJSON: GeoJSON.FeatureCollection;
  avoidanceGeoJSON: GeoJSON.FeatureCollection;
  constructionGeoJSON: GeoJSON.FeatureCollection;
  poiGeoJSON: GeoJSON.FeatureCollection;
  reportGeoJSON: GeoJSON.FeatureCollection | null;
  routeGeoJSON: GeoJSON.FeatureCollection | null;
  clusteredEntrancePOIs: any[];
  aaPointsReport: LatLng[];
  clickedPoint: LatLng | null;
  // ── styles ───────────────────────────────────────────────────────────────────
  showDetailedLayers: boolean;
  isReportMode: boolean;
  buildingExtrusionColor: any;
  labelTextColor: string;
  labelHaloColor: string;
  // ── zoom thresholds ──────────────────────────────────────────────────────────
  minZoomBuildings: number;
  minZoomPOIs: number;
  minZoomSidewalks: number;
  minZoomBarriers: number;
  minZoomLabels: number;
  maxZoomLabels: number;
  // ── tap guard ref ────────────────────────────────────────────────────────────
  featureTappedRef: RefObject<boolean>;
  // ── press handlers ───────────────────────────────────────────────────────────
  onBuildingPress: (feature: GeoJSON.Feature) => void;
  onSidewalkPress: (segment: SidewalkSegment) => void;
  onAvoidanceAreaPress: (id: string) => void;
  onConstructionPress: (id: string, description?: string) => void;
  onBarrierPress: (properties: Record<string, any>) => void;
  onPOIPress: (poi: any) => void;
  onRampPress: (feature: GeoJSON.Feature) => void;
};

export function MapLayersRenderer({
  buildingsGeoJSON,
  sidewalksGeoJSON,
  barriersGeoJSON,
  rampsGeoJSON,
  avoidanceGeoJSON,
  constructionGeoJSON,
  poiGeoJSON,
  reportGeoJSON,
  routeGeoJSON,
  clusteredEntrancePOIs,
  aaPointsReport,
  clickedPoint,
  showDetailedLayers,
  isReportMode,
  buildingExtrusionColor,
  labelTextColor,
  labelHaloColor,
  minZoomBuildings,
  minZoomPOIs,
  minZoomSidewalks,
  minZoomBarriers,
  minZoomLabels,
  maxZoomLabels,
  featureTappedRef,
  onBuildingPress,
  onSidewalkPress,
  onAvoidanceAreaPress,
  onConstructionPress,
  onBarrierPress,
  onPOIPress,
  onRampPress,
}: MapLayersRendererProps) {
  return (
    <>
      {/* ── Icon images for POI SymbolLayer ─────────────────────────────────── */}
      <Images
        images={{
          autoDoor: require("../../assets/map_icons/auto_door.png"),
          manualDoor: require("../../assets/map_icons/manual_door.png"),
          rampIcon: require("../../assets/map_icons/ramp.png"),
        }}
      />

      {/* ── 3D Terrain ──────────────────────────────────────────────────────── */}
      <RasterDemSource
        id="mapbox-dem"
        url="mapbox://mapbox.mapbox-terrain-dem-v1"
        tileSize={512}
        maxZoomLevel={14}
      />
      <Terrain sourceID="mapbox-dem" exaggeration={1.5} />

      {/* ── Atmospheric sky ─────────────────────────────────────────────────── */}
      <SkyLayer
        id="sky"
        style={{
          skyType: "atmosphere",
          skyAtmosphereSun: [0.0, 90.0],
          skyAtmosphereSunIntensity: 15,
        }}
      />

      {/* ── 3D Campus Buildings + Abbreviation Labels ───────────────────────── */}
      <ShapeSource
        id="campus-buildings"
        shape={buildingsGeoJSON}
        onPress={(e: any) => {
          if (isReportMode) return;
          featureTappedRef.current = true;
          const feature = e.features[0];
          if (feature) onBuildingPress(feature as GeoJSON.Feature);
        }}
      >
        <FillExtrusionLayer
          id="campus-buildings-3d"
          minZoomLevel={minZoomBuildings}
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
              "interpolate", ["linear"], ["zoom"], 14, 0.6, 17, 0.9,
            ],
          }}
        />
        <SymbolLayer
          id="campus-building-labels"
          minZoomLevel={minZoomLabels}
          maxZoomLevel={maxZoomLabels}
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

      {/* ── Sidewalk accessibility overlay ────────── */}
      {showDetailedLayers && (
        <ShapeSource
          id="sidewalks"
          shape={sidewalksGeoJSON}
          onPress={(e: any) => {
            if (isReportMode) return;
            featureTappedRef.current = true;
            const feat = e.features[0];
            if (feat?.properties) {
              onSidewalkPress({
                id: String(feat.id ?? feat.properties.OBJECTID ?? ""),
                compliant: feat.properties.compliant ?? null,
                score: feat.properties.score ?? 0,
              });
            }
          }}
        >
          <FillLayer
            id="sidewalk-fill"
            minZoomLevel={minZoomSidewalks}
            style={{
              fillColor: [
                "match", ["coalesce", ["get", "compliant"], -1],
                1, "rgba(34,197,94,0.35)",
                0, "rgba(239,68,68,0.35)",
                "rgba(156,163,175,0.25)",
              ],
            }}
          />
          <LineLayer
            id="sidewalk-line"
            minZoomLevel={minZoomSidewalks}
            style={{
              lineColor: [
                "match", ["coalesce", ["get", "compliant"], -1],
                1, "rgba(34,197,94,0.7)",
                0, "rgba(239,68,68,0.7)",
                "rgba(156,163,175,0.5)",
              ],
              lineWidth: 1,
            }}
          />
        </ShapeSource>
      )}

      {/* ── Avoidance areas ─────────────────────────────────────────────────── */}
      <ShapeSource
        id="avoidance-areas"
        shape={avoidanceGeoJSON}
        onPress={(e: any) => {
          if (isReportMode) return;
          featureTappedRef.current = true;
          const id = e.features[0]?.properties?.id;
          if (id) onAvoidanceAreaPress(id);
        }}
      >
        <FillLayer id="avoidance-fill" style={{ fillColor: "rgba(209,0,0,0.2)" }} />
        <LineLayer id="avoidance-line" style={{ lineColor: "rgba(209,0,0,0.6)", lineWidth: 1.5 }} />
      </ShapeSource>

      {/* ── Live construction zones (ArcGIS) ────────────────────────────────── */}
      <ShapeSource
        id="construction"
        shape={constructionGeoJSON}
        onPress={(e: any) => {
          if (isReportMode) return;
          featureTappedRef.current = true;
          const id = e.features[0]?.properties?.id as string;
          const description = e.features[0]?.properties?.description as string | undefined;
          if (id) onConstructionPress(id, description);
        }}
      >
        <FillLayer id="construction-fill" style={{ fillColor: "rgba(245,158,11,0.25)" }} />
        <LineLayer id="construction-line" style={{ lineColor: "rgba(217,119,6,0.8)", lineWidth: 2 }} />
      </ShapeSource>

      {/* ── Accessibility barriers (points) ─────────────────────────────────── */}
      {showDetailedLayers && (
        <ShapeSource
          id="barriers"
          shape={barriersGeoJSON}
          onPress={(e: any) => {
            if (isReportMode) return;
            featureTappedRef.current = true;
            const props = e.features[0]?.properties;
            if (props) onBarrierPress(props);
          }}
        >
          <CircleLayer
            id="barriers-circle"
            minZoomLevel={minZoomBarriers}
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

      {/* ── In-progress report polygon ───────────────────────────────────────── */}
      {reportGeoJSON && (
        <ShapeSource id="report-shape" shape={reportGeoJSON}>
          <FillLayer
            id="report-fill"
            style={{ fillColor: "rgba(255,0,0,0.25)" }}
            filter={["==", ["geometry-type"], "Polygon"]}
          />
          <LineLayer id="report-line" style={{ lineColor: "red", lineWidth: 2 }} />
        </ShapeSource>
      )}

      {/* ── Route overlay ────────────────────────────────────────────────────── */}
      {routeGeoJSON && (
        <ShapeSource id="route-shape" shape={routeGeoJSON}>
          <LineLayer
            id="route-line"
            style={{ lineColor: "#50df49", lineWidth: 4, lineCap: "round", lineJoin: "round" }}
          />
        </ShapeSource>
      )}

      {/* ── Report mode point markers ────────────────────────────────────────── */}
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

      {/* ── POI markers ─────────────────────────────────────────────────────── */}
      {!isReportMode && (
        <ShapeSource
          id="pois"
          shape={poiGeoJSON}
          onPress={(e: any) => {
            featureTappedRef.current = true;
            const id = e.features[0]?.properties?.id;
            const poi = clusteredEntrancePOIs.find((p) => String(p.id) === id);
            if (poi) onPOIPress(poi);
          }}
        >
          <SymbolLayer
            id="poi-symbols"
            minZoomLevel={minZoomPOIs}
            style={{
              iconImage: ["get", "icon"],
              iconSize: ["interpolate", ["linear"], ["zoom"], 14, 0.15, 16, 0.25, 18, 0.40, 20, 0.60],
              iconAllowOverlap: true,
              iconAnchor: "bottom",
            }}
          />
        </ShapeSource>
      )}

      {/* ── Ramp markers ────────────────────────────────────────────────────── */}
      {!isReportMode && (
        <ShapeSource
          id="ramps"
          shape={rampsGeoJSON}
          onPress={(e: any) => {
            featureTappedRef.current = true;
            const feature = e.features[0];
            if (feature) onRampPress(feature as GeoJSON.Feature);
          }}
        >
          <SymbolLayer
            id="ramp-symbols"
            minZoomLevel={minZoomPOIs}
            style={{
              iconImage: "rampIcon",
              iconSize: ["interpolate", ["linear"], ["zoom"], 14, 0.15, 16, 0.25, 18, 0.40, 20, 0.60],
              iconAllowOverlap: true,
              iconAnchor: "bottom",
            }}
          />
        </ShapeSource>
      )}
    </>
  );
}
