import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useIsFocused } from "@react-navigation/native";
import Mapbox, {
  Camera,
  Images,
  MapView,
  PointAnnotation,
} from "@rnmapbox/maps";
import { Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AvoidanceAreaBottomSheet from "~/src/features/components/AvoidanceAreaBottomSheet";
import BarrierBottomSheet from "~/src/features/components/BarrierBottomSheet";
import ConstructionBottomSheet from "~/src/features/components/ConstructionBottomSheet";
import { DirectionsBanner } from "~/src/features/components/DirectionsBanner";
import {
  LocationDetailsBottomSheet,
  type LocationDetailsBottomSheetRef,
} from "~/src/features/components/LocationDetailsBottomSheet";
import { NavigationBottomBar } from "~/src/features/components/NavigationBottomBar";
import POIBottomSheet, { POIReviewData } from "~/src/features/components/POIBottomSheet";
import ReviewModal from "~/src/features/components/ReviewModal";
import RoutePreviewSheet from "~/src/features/components/RoutePreviewSheet";
import { SearchBar } from "~/src/features/components/SearchBar";
import { SearchDropdown } from "~/src/features/components/SearchDropdown";
import SidewalkBottomSheet, { type SidewalkSegment } from "~/src/features/components/SidewalkBottomSheet";
import { getBuildingStyles } from "~/src/features/map/buildingStyles";
import * as MapConstants from "~/src/features/map/constants";
import { useAvoidanceGeoJSON } from "~/src/features/map/geojsonSources/useAvoidanceGeoJSON";
import { useConstructionGeoJSON } from "~/src/features/map/geojsonSources/useConstructionGeoJSON";
import { useLocationService } from "~/src/features/map/hooks/useLocationService";
import { useMapGeoJSON } from "~/src/features/map/hooks/useMapGeoJSON";
import { usePOIFeatures } from "~/src/features/map/POIs/usePOIFeatures";
import { MapLayers } from "~/src/features/map/rendering/MapLayers";
import { POIReportOverlay } from "~/src/features/map/rendering/POIReportOverlay";
import { ReportOverlay } from "~/src/features/map/rendering/ReportOverlay";
import UserOverlay from "~/src/features/map/rendering/userOverlay";
import { useMapScreenController } from "~/src/features/map/useMapScreenController";
import {
  usePOIs,
  useAvoidanceAreas,
  useConstructionAreas,
  useInsertAvoidanceArea,
  useInsertPOIReport,
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
  const canReport =
    user?.role === "student" ||
    user?.email?.toLowerCase().endsWith("@utexas.edu") === true;
  const isDark = colorScheme === "dark";

  const { sidewalksGeoJSON, buildingsGeoJSON, barriersGeoJSON, rampsGeoJSON } = useMapGeoJSON();

  const [zoomLevel, setZoomLevel] = useState(15);
  const [cameraState, setCameraState] = useState<any>(null)

  // Data hooks
  const { data: avoidanceAreas } = useAvoidanceAreas();
  const { data: constructionAreas } = useConstructionAreas();
  const { data: POIs } = usePOIs();
  const { mutateAsync: insertAvoidanceArea } = useInsertAvoidanceArea();
  const { mutateAsync: insertPOIReport } = useInsertPOIReport();

  const avoidanceGeoJSON = useAvoidanceGeoJSON(avoidanceAreas);
  const constructionGeoJSON = useConstructionGeoJSON(constructionAreas);
  const { poiGeoJSON, clusteredEntrancePOIs, entrances } = usePOIFeatures(POIs);

  const locationService = useLocationService();

  const map = useMapScreenController({
    isTabFocused,
    bottomTabBarHeight,
    avoidanceAreas,
    constructionAreas,
    entrances,
  });

  const { navigation } = map;
  const isNavigating = navigation.state.isNavigating;

  // Show navigation route while navigating, preview route while the sheet is open
  const routeGeoJSON = useMemo((): GeoJSON.FeatureCollection | null => {
    const coords = isNavigating
      ? navigation.state.route?.coordinates
      : map.routePreview.state.isOpen
        ? map.routePreview.state.route?.coordinates
        : undefined;
    if (!coords || coords.length < 2) return null;
    return {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: coords },
      }],
    };
  }, [isNavigating, navigation.state.route, map.routePreview.state.isOpen, map.routePreview.state.route]);

  // Fit camera to show the full route whenever the preview route loads
  useEffect(() => {
    if (isNavigating) return;
    const route = map.routePreview.state.route;
    if (!route || route.coordinates.length < 2) return;
    const lngs = route.coordinates.map(([lng]) => lng);
    const lats = route.coordinates.map(([, lat]) => lat);
    const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
    const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
    // Bottom padding accounts for the route preview sheet (~42% screen height)
    map.cameraRef.current?.fitBounds(ne, sw, [80, 40, 220, 40], 800);
  }, [map.routePreview.state.route]);

  // Fly to the start coordinate of the active navigation step when it changes
  useEffect(() => {
    if (!isNavigating || !navigation.state.route) return;
    const step = navigation.state.route.steps[navigation.state.currentStepIndex];
    if (step?.coordinate) {
      map.cameraRef.current?.flyTo(step.coordinate, 500);
    }
  }, [navigation.state.currentStepIndex]);

  const emptyPOIs = useMemo(() => [], []);

  // When navigation starts, fly to the first step's location at street-level zoom
  const prevIsNavigating = useRef(false);
  useEffect(() => {
    if (isNavigating && !prevIsNavigating.current) {
      const step = navigation.state.route?.steps[0];
      const coord = step?.coordinate ?? navigation.state.userPosition;
      map.cameraRef.current?.setCamera({
        centerCoordinate: coord,
        zoomLevel: 18,
        pitch: 60,
        animationDuration: 800,
      });
    }
    prevIsNavigating.current = isNavigating;
  }, [isNavigating]);

  const handleGoFromPreview = useCallback(async () => {
    const { destinationCoords, destinationName, profile, route } = map.routePreview.state;
    if (!destinationCoords) return;
    map.bottomSheet.ref.routePreviewSheet.current?.dismiss();
    map.routePreview.action.closePreview();
    await navigation.action.startNavigation(
      destinationCoords,
      destinationName,
      profile,
      route ?? undefined,
    );
  }, [map.routePreview, map.bottomSheet.ref, navigation.action]);

  return (
    <>
      <Stack.Screen options={{ title: "Home", headerShown: false }} />

      {/* iOS status bar background — adapts to theme when not in navigation */}
      {Platform.OS === "ios" && !isNavigating && !map.report.state.isReportMode && !map.poiReport.state.isPOIReportMode && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: insets.top,
            backgroundColor: isDark ? "#1A2024" : "#FFFFFF",
            zIndex: 19,
          }}
          pointerEvents="none"
        />
      )}

      {/* Directions banner — shown at top during navigation */}
      {isNavigating && (
        <DirectionsBanner
          step={navigation.state.route?.steps[navigation.state.currentStepIndex]}
          leadDistance={
            navigation.state.currentStepIndex > 0
              ? navigation.state.route?.steps[navigation.state.currentStepIndex - 1]?.distance
              : undefined
          }
          isDark={isDark}
          insetTop={insets.top}
        />
      )}

      {/* Search bar — hidden in report mode and during navigation */}
      {!map.report.state.isReportMode && !isNavigating && !map.poiReport.state.isPOIReportMode && (
        <SearchBar
          onPress={() => map.search.action.open()}
          onChangeText={map.search.action.handleSearchChange}
          onClear={() => map.search.action.clear()}
          value={map.search.state.searchQuery}
          editable={map.search.state.isSearchActive}
          isActive={map.search.state.isSearchActive}
          style={{
            position: "absolute",
            top: insets.top + 10,
            left: 16,
            right: 16,
            zIndex: 20,
          }}
        />
      )}

      {/* Search results dropdown */}
      {!map.report.state.isReportMode && !isNavigating && !map.poiReport.state.isPOIReportMode && (
        <SearchDropdown
          visible={map.search.state.isSearchActive}
          searchQuery={map.search.state.searchQuery}
          onSelectLocation={map.search.action.handleSelectLocation}
          onDismiss={() => map.search.action.clear()}
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
            onRequestPreview={map.handleRequestPreview}
            handleReports={(reportData) => {
              map.bottomSheet.action.closeAllSheets();
              map.search.action.clear();
              map.poiReport.action.setReportData(reportData);
              map.poiReport.action.setIsPOIReportMode(true);
            }}
          />
          <RoutePreviewSheet
            ref={map.bottomSheet.ref.routePreviewSheet}
            previewState={map.routePreview.state}
            onGo={handleGoFromPreview}
            onChangeProfile={map.routePreview.action.changeProfile}
            onSwapOriginDest={map.routePreview.action.swapOriginDest}
            onSetOrigin={map.routePreview.action.setOrigin}
            onSetDestination={map.routePreview.action.setDestination}
            onAddStop={map.routePreview.action.addStop}
            onRemoveStop={map.routePreview.action.removeStop}
            onToggleDirectionsList={map.routePreview.action.toggleDirectionsList}
            onDismiss={map.routePreview.action.closePreview}
          />
          <SidewalkBottomSheet ref={map.bottomSheet.ref.sidewalkBottomSheet} />
          <LocationDetailsBottomSheet ref={map.bottomSheet.ref.locationBottomSheet} />
          <BarrierBottomSheet ref={map.bottomSheet.ref.barrierBottomSheet} />
          <ConstructionBottomSheet ref={map.bottomSheet.ref.constructionBottomSheet} />

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
              onActiveChange={map.setReviewActive}
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
        compassViewPosition={1}
        compassViewMargins={{ x: 16, y: insets.top + 70 }}
        attributionEnabled
        logoEnabled
        onCameraChanged={(state) => {
          setCameraState(state.properties);
          setZoomLevel(state.properties.zoom)
        }}
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
          } else if (!isNavigating) {
            map.closeAllSheets();
          }
        }}
      >
        <Camera
          ref={map.cameraRef}
          defaultSettings={{
            centerCoordinate: MapConstants.UT_CENTER,
            zoomLevel: 15,
            pitch: 45,
          }}
        />

        {/* User position marker during navigation (UT Tower placeholder) */}
        {isNavigating && (
          <PointAnnotation
            id="nav-user-position"
            coordinate={navigation.state.userPosition}
          >
            <Image
              source={mapIcons.crosshair}
              style={{ width: 28, height: 28 }}
            />
          </PointAnnotation>
        )}

        {/* ── Icon images for POI SymbolLayer & User Navigation ──────────────────────────────── */}
        <Images
          images={{
            autoDoor: require("../../assets/map_icons/auto_door.png"),
            manualDoor: require("../../assets/map_icons/manual_door.png"),
            rampIcon: require("../../assets/map_icons/ramp.png"),
            userIcon: require("../../assets/map_icons/user_point.png"),
            userDirector: require("../../assets/map_icons/user_facing.png"),
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
          routeGeoJSON={routeGeoJSON}
          showDetailedLayers={map.showDetailedLayers}
          isReportMode={map.report.state.isReportMode}
          isPOIReportMode={map.poiReport.state.isPOIReportMode}
          aaPointsReport={map.report.state.aaPointsReport}
          clickedPoint={map.report.state.clickedPoint}
          clusteredEntrancePOIs={clusteredEntrancePOIs}
          buildingStyles={getBuildingStyles(isDark)}
          mapIcons={mapIcons}
          cameraState={cameraState}
          geoLocation={locationService.state.geoLocation}
          deviceMotion={locationService.state.deviceMotion}
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

      {!map.report.state.isReportMode && (
        <POIReportOverlay
          report={map.poiReport}
          insets={insets}
          insertPOIReport={insertPOIReport}
        />
      )}

      {!map.report.state.isReportMode && (
        <UserOverlay
          geoLocation={locationService.state.geoLocation}
          deviceMotion={locationService.state.deviceMotion}
          cameraRef={map.cameraRef}
        />
      )}

      {!map.poiReport.state.isPOIReportMode && (
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
      )}

      {/* Navigation bottom bar */}
      {isNavigating && (
        <NavigationBottomBar
          destinationName={navigation.state.destinationName}
          totalDistanceMi={navigation.state.route?.totalDistanceMi ?? 0}
          totalDurationSec={navigation.state.route?.totalDurationSec ?? 0}
          currentStepIndex={navigation.state.currentStepIndex}
          totalSteps={navigation.state.route?.steps.length ?? 1}
          isMuted={navigation.state.isMuted}
          isDark={isDark}
          bottomInset={bottomTabBarHeight}
          onToggleMute={navigation.action.toggleMute}
          onNextStep={navigation.action.nextStep}
          onPrevStep={navigation.action.prevStep}
          onReportIncident={() => {
            map.bottomSheet.action.closeAllSheets();
            map.search.action.clear();
            map.report.action.setIsReportMode(true);
          }}
          onEnd={navigation.action.endNavigation}
        />
      )}
    </>
  );
}
