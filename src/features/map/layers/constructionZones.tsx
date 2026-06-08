// Rendering layer for construction zones

import { ShapeSource, FillLayer, LineLayer } from "@rnmapbox/maps";

type Props = {
    geojson: GeoJSON.FeatureCollection;
    isReportMode: boolean;
    onPress: (id: string, description?: string) => void;
    onFeatureTap?: () => void;
  };
  export default function ConstructionZones({
    geojson,
    isReportMode,
    onPress,
    onFeatureTap,
  }: Props) {
    return (
<ShapeSource
          id="construction"
          shape={geojson}
          onPress={(e: any) => {
            if (isReportMode) return;
          
            onFeatureTap?.();
          
            const feature = e.features?.[0];
          
            const id = feature?.properties?.id;
            const description = feature?.properties?.description;
          
            if (id) {
              onPress(String(id), description);
            }
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
        </ShapeSource>);}