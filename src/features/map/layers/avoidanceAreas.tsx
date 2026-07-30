// Rendering layer for avoidance areas

import { ShapeSource, FillLayer, LineLayer } from "@rnmapbox/maps";

type Props = {
    geojson: GeoJSON.FeatureCollection;
    isReportMode: boolean;
    onPress: (id: string) => void;
    onFeatureTap?: () => void;
  };


export default function AvoidanceAreas({
    geojson,
    isReportMode,
    onPress,
    onFeatureTap,
  }: Props) {
    return (
<ShapeSource
    id="avoidance-areas"
    shape={geojson}
    onPress={(e: any) => {
    if (isReportMode) return;
    
    onFeatureTap?.();

    const id = e.features?.[0]?.properties?.id;

    if (id) onPress(String(id));
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
</ShapeSource>);}