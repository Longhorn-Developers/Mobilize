import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useIsFocused } from "@react-navigation/native";
import Mapbox, {
  Camera,
  Images,
  MapView,
} from "@rnmapbox/maps";
import { Stack } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AvoidanceAreaBottomSheet from "~/src/features/components/AvoidanceAreaBottomSheet";
import BarrierBottomSheet from "~/src/features/components/BarrierBottomSheet";
import ConstructionBottomSheet from "~/src/features/components/ConstructionBottomSheet";
import {
  LocationDetailsBottomSheet,
  type LocationDetailsBottomSheetRef,
} from "~/src/features/components/LocationDetailsBottomSheet";
import POIBottomSheet, { POIReviewData } from "~/src/features/components/POIBottomSheet";
import ReviewModal from "~/src/features/components/ReviewModal";
import { SearchBar } from "~/src/features/components/SearchBar";
import { SearchDropdown } from "~/src/features/components/SearchDropdown";
import SidewalkBottomSheet, { type SidewalkSegment } from "~/src/features/components/SidewalkBottomSheet";
import { getBuildingStyles } from "~/src/features/map/buildingStyles";
import * as MapConstants from "~/src/features/map/constants";
import { useAvoidanceGeoJSON } from "~/src/features/map/geojsonSources/useAvoidanceGeoJSON";
import { useConstructionGeoJSON } from "~/src/features/map/geojsonSources/useConstructionGeoJSON";
import { useMapGeoJSON } from "~/src/features/map/hooks/useMapGeoJSON";
import { usePOIFeatures } from "~/src/features/map/POIs/usePOIFeatures";
import { MapLayers }  from "~/src/features/map/rendering/MapLayers";
import { ReportOverlay } from "~/src/features/map/rendering/ReportOverlay";
import { useMapScreenController } from "~/src/features/map/useMapScreenController";
import {
  usePOIs,
  useAvoidanceAreas,
  useConstructionAreas,
  useInsertAvoidanceArea,
} from "~/utils/api-hooks";
import { useTheme } from "~/utils/ThemeContext";
import { useAuth } from "~/utils/useAuth";
import { mapIcons } from "~/utils/useMapIcons";
// Initialise Mapbox
const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
if (!mapboxToken) throw new Error("Missing EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN in .env");
Mapbox.setAccessToken(mapboxToken);

export default function Home() {
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight();
  const isTabFocused = useIsFocused();
  const { user } = useAuth();
  const { colorScheme } = useTheme();
  const canReport = //true;
    user?.role === "student" ||
    user?.email?.toLowerCase().endsWith("@utexas.edu") === true;
  const isDark = colorScheme === "dark";

  // Loads GeoJSON data for sidewalks, buildings, barriers, and ramps (src/features/map/hooks/geojsonBuilders.ts)
  const { sidewalksGeoJSON, buildingsGeoJSON, barriersGeoJSON, rampsGeoJSON } = useMapGeoJSON();

  // Encompasses all report related states/functions (src/features/map/hooks/useReportMode.ts)
  const [Route] = useState<[number, number][] | null>(null);
  const [zoomLevel, setZoomLevel] = useState(15);


  // Data hooks
  const { data: avoidanceAreas } = useAvoidanceAreas();
  const { data: constructionAreas } = useConstructionAreas();
  const { data: POIs } = usePOIs();
  const { mutateAsync: insertAvoidanceArea } = useInsertAvoidanceArea();

  // GeoJSON sources
  const avoidanceGeoJSON = useAvoidanceGeoJSON(avoidanceAreas);
  const constructionGeoJSON = useConstructionGeoJSON(constructionAreas);
  const { poiGeoJSON, clusteredEntrancePOIs, entrances } = usePOIFeatures(POIs);

  const map = useMapScreenController({
    isTabFocused,
    bottomTabBarHeight,
    avoidanceAreas,
    entrances,
  });

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

  const emptyPOIs = useMemo(() => [], []);

  return (
    <>
      <Stack.Screen options={{ title: "Home", headerShown: false }} />

      {/* Search bar — hidden in report mode */}
      {!map.report.state.isReportMode && (
        <SearchBar
          onPress={() => map.search.action.open()}
          onChangeText={map.search.action.handleSearchChange}
          onClear={() => {
            map.search.action.clear();
          }}
          value={map.search.state.searchQuery}
          editable={map.search.state.isSearchActive}
          isActive={map.search.state.isSearchActive}
          className="absolute left-4 right-4 z-20"
          style={{ top: insets.top + 10 }}
        />
      )}

      {/* Search results dropdown */}
      {!map.report.state.isReportMode && (
        <SearchDropdown
          visible={map.search.state.isSearchActive}
          searchQuery={map.search.state.searchQuery}
          onSelectLocation={map.search.action.handleSelectLocation}
          onDismiss={() => {
            map.search.action.clear();
          }}
          topOffset={insets.top + 70}
        />
      )}

      {/* Bottom sheets */}
      {isTabFocused ? (
        <>
          <AvoidanceAreaBottomSheet ref={map.bottomSheet.ref.avoidanceAreaBottomSheet} />
          <POIBottomSheet
            ref={map.bottomSheet.ref.poiBottomSheet}
            allPOIs={POIs ?? emptyPOIs}
            handleReviews={map.handleEnterReviewMode}
          />
          <SidewalkBottomSheet ref={map.bottomSheet.ref.sidewalkBottomSheet} />
          <LocationDetailsBottomSheet ref={map.bottomSheet.ref.locationBottomSheet} />
          <BarrierBottomSheet ref={map.bottomSheet.ref.barrierBottomSheet} />
          <ConstructionBottomSheet ref={map.bottomSheet.ref.constructionBottomSheet} />

          {/* Review Modal */}
          <BottomSheetModal
            ref={map.bottomSheet.ref.reviewSheet}
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
              key={map.reviewKey}
              className=""
              poi_id={map.poi ? map.poi.id : 0}
              entrances={map.poi ? map.poi.entrances : []}
              entranceName={map.poi ? map.poi.entrance : "No Entrance Name Found"}
              building={map.poi && map.poi.building}
              buildingName={map.poi ? map.poi.buildingName : "No Building Name Found"}
              onExit={map.handleExitReviewMode}
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
        // compassEnabled /* Disabled for now, not sure of how it looks */
        compassViewPosition={1}
        compassViewMargins={{ x: 16, y: insets.top + 70 }}
        attributionEnabled
        logoEnabled
        onCameraChanged={(state) => setZoomLevel(state.properties.zoom)}
        compassEnabled={false}
        onPress={(feature: any) => {
          if (map.featureTappedRef.current) {
            map.featureTappedRef.current = false;
            return;
          }
          if (map.report.state.isReportMode) {
            const coords = (feature as GeoJSON.Feature<GeoJSON.Point>).geometry?.coordinates;
            if (coords) {
              map.report.action.handleMapTap({
                longitude: coords[0] as number,
                latitude: coords[1] as number,
              });
            }
          } else {
            map.closeAllSheets();
          }
        }}
      >
        {/* Camera */}
        <Camera
          ref={map.cameraRef}
          defaultSettings={{
            centerCoordinate: MapConstants.UT_CENTER,
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

        <MapLayers
          buildingsGeoJSON={buildingsGeoJSON}
          sidewalksGeoJSON={sidewalksGeoJSON}
          barriersGeoJSON={barriersGeoJSON}
          rampsGeoJSON={rampsGeoJSON}
          avoidanceGeoJSON={avoidanceGeoJSON}
          constructionGeoJSON={constructionGeoJSON}
          poiGeoJSON={poiGeoJSON}
          reportGeoJSON={map.report.state.reportGeoJSON}
          showDetailedLayers={map.showDetailedLayers}
          isReportMode={map.report.state.isReportMode}
          aaPointsReport={map.report.state.aaPointsReport}
          clickedPoint={map.report.state.clickedPoint}
          clusteredEntrancePOIs={clusteredEntrancePOIs}
          buildingStyles={getBuildingStyles(isDark)}
          mapIcons={mapIcons}
          onBuildingPress={map.mapPress.action.handleBuildingTap}
          onSidewalkPress={map.mapPress.action.handleSidewalkPress}
          onAvoidanceAreaPress={map.mapPress.action.handleAvoidanceAreaPress}
          onConstructionPress={map.mapPress.action.handleConstructionPress}
          onBarrierPress={map.mapPress.action.handleBarrierPress}
          onPOIPress={map.mapPress.action.handlePOIPress}
          onRampPress={map.mapPress.action.handleRampPress}
          onFeatureTapped={() => { map.featureTappedRef.current = true; }}
        />
      </MapView>
      <ReportOverlay
        report={map.report}
        canReport={canReport}
        insets={insets}
        insertAvoidanceArea={insertAvoidanceArea}
        onEnterReport={() => {
          map.bottomSheet.action.closeAllSheets();
          map.search.action.clear();
          map.report.action.setIsReportMode(true);
        }}
      />
    </>
  );
}
