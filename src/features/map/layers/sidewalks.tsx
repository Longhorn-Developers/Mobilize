// Rendering layer for sidewalks

import { ShapeSource, FillLayer, LineLayer } from "@rnmapbox/maps";
import * as MapConstants from "../constants";
import SidewalkBottomSheet, { type SidewalkSegment } from "~/src/features/components/SidewalkBottomSheet";

type Props = {
    geojson: GeoJSON.FeatureCollection;
    visible: boolean;
    isReportMode: boolean;
    onPress: (segment: SidewalkSegment) => void;
  };

  export default function SidewalkLayer({
    geojson,
    visible,
    isReportMode,
    onPress,
  }: Props) {
    if (!visible) return null;
  
    return (
    <ShapeSource
        id="sidewalks"
        shape={geojson}
        onPress={(e) => {
        if (isReportMode) return;

        const feature = e.features?.[0];
        if (!feature?.properties) return;

        onPress({
            id: String(
            feature.id ??
            feature.properties.OBJECTID ??
            ""
            ),
            compliant: feature.properties.compliant ?? null,
            score: feature.properties.score ?? 0,
        });
        }}
    >
      <FillLayer
        id="sidewalk-fill"
        minZoomLevel={MapConstants.MIN_ZOOM_FOR_SIDEWALKS}
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
        minZoomLevel={MapConstants.MIN_ZOOM_FOR_SIDEWALKS}
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
    );}