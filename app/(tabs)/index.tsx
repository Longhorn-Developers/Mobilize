import { Stack } from "expo-router";
import { useState, useRef, useEffect } from "react";
import { View } from "react-native";
import { AppleMaps, Coordinates } from "expo-maps";
import { useImage } from "expo-image";
import { AppleMapsPolygon } from "expo-maps/build/apple/AppleMaps.types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/Button";
import ReportModal from "~/components/ReportModal";
import AvoidanceAreaBottomSheet from "~/components/AvoidanceAreaBottomSheet";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useQuery } from "@supabase-cache-helpers/postgrest-react-query";
import { supabase } from "~/utils/supabase";
import * as turf from "@turf/turf";
import Toast from "react-native-toast-message";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useInsertMutation } from '@supabase-cache-helpers/postgrest-react-query'

import UpdatePopup from "~/components/UpdateAA";

import { useQueryClient, useMutation } from '@tanstack/react-query';

import { lineIntersect } from "@turf/line-intersect";
import { feature, lineString } from '@turf/helpers';

import { v4 as uuidv4 } from 'uuid';


import { LineString } from "geojson";

export const useInsertAvoidanceAreaRPC = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({name, wkt, publisher_id}: {name:string, wkt:string, publisher_id: string}) => {
      const {data, error} = await supabase.rpc('insert_avoidance_area', {
        p_name:name,
        p_wkt:wkt,
        publisher_id: publisher_id
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate all queries for this table - this is the safest approach
      queryClient.invalidateQueries();
      console.log("Successfully invalidated avoidance_areas_with_geojson queries");
      
    }
  });
};

export const insertAvoidanceAreaDetailsRPC = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({name, description, id}: {name:string, description:string, id:string}) => {
      const {data, error} = await supabase.rpc('insert_aa_details', {
        aa_description:description,
        aa_title:name,
        aa_id:id

      });
      if (error) throw error;
      return data;

    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      console.log("Successfully invalidated avoidance_area_reports queries");
    }
  })
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight();

  const [isReportMode, setIsReportMode] = useState(false);
  const [aaPointsReport, setAAPointsReport] = useState<Coordinates[]>([]);

  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  const [selectedAAID, setSelectedAAID] = useState('');
  
  const [aaLines, setAALines] = useState([]);
  const { mutateAsync: insertAA, isPending, error } = useInsertAvoidanceAreaRPC();
  const { mutateAsync: insertAADetails} = insertAvoidanceAreaDetailsRPC();
  const [description, setDescription] = useState("");


  //const [intersectionPoints, setIntersectionPoints] = useState<LatLng[]>([]);
  
  const [reportStep, setReportStep] = useState(0);

  const bottomSheetRef = useRef<BottomSheetModal>(null);

  const pointImage = useImage(require("../../assets/point.svg"), {
    maxWidth: 32,
    maxHeight: 32,
    onError(error) {
      console.error(error);
    },
  });

  const { data: avoidanceAreas } = useQuery(
    supabase.from("avoidance_areas_with_geojson").select("id,name,boundary"),
  );

  // Checks if resulting polygon formed by aaPointsReport + points is valid (no kinks)
  const isPointValid = (point: Coordinates) => {
    if (aaPointsReport.length < 3) return true; // Need at least 3 points to form a polygon

    const polygon = turf.polygon([
      [
        ...aaPointsReport.map((p) => [p.longitude || 0, p.latitude || 0]),
        [point.longitude || 0, point.latitude || 0],
        [aaPointsReport[0].longitude || 0, aaPointsReport[0].latitude || 0],
      ],
    ]);
    const kinks = turf.kinks(polygon);

    // No kinks means the polygon is valid
    return kinks.features.length === 0;
  };

  // Add pressed coordinates to marked points
  /*
  const handleMapPress = (event: MapPressEvent) => {
    if (
      !isReportMode ||
      !event.nativeEvent.coordinate ||
      aaPoints.includes(event.nativeEvent.coordinate)
    )
      return;
    if (isReportMode) {
      if (reportStep !== 0) return;
    event.persist();
    setAAPoints((prev) => [...(prev || []), event.nativeEvent.coordinate]);
  };
  */

  const handleMapPress = (event: Coordinates) => {
    if (isReportMode) {
      if (reportStep !== 0) return;

      if (isPointValid(event)) {
        // Add pressed coordinates to marked points
        setAAPointsReport((prev) => [...prev, event]);
      } else {
        Toast.show({
          type: "error",
          text2: "Invalid point! Please select a different point.",
          position: "bottom",
          bottomOffset: bottomTabBarHeight + 50,
        });
      }
    } else {
      bottomSheetRef.current?.close();
    }
  };

  const handleAvoidanceAreaPress = (event: AppleMapsPolygon) => {
    if (isReportMode) return;
    bottomSheetRef.current?.present(event);
  };

  return (
    <>
      <Stack.Screen options={{ title: "Home", headerShown: false }} />

      {/* Avoidance Area Bottom Sheet */}
      <AvoidanceAreaBottomSheet ref={bottomSheetRef} />

      <AppleMaps.View
        style={{ flex: 1 }}
        onMapClick={() => handleMapPress}
        onPolygonClick={handleAvoidanceAreaPress}
        polygons={[
          // Avoidance areas from the database
          ...(avoidanceAreas || []).map<AppleMapsPolygon>((area) => ({
            id: area.id || undefined,
            coordinates:
              area.boundary?.coordinates[0].map((coord) => ({
                latitude: coord[1],
                longitude: coord[0],
              })) || [],
            color: "rgba(255, 0, 0, 0.25)",
            lineColor: "rgba(255, 0, 0, 0.5)",
            lineWidth: 0.1,
          })),
          // User selected aaPoints to report
          {
            coordinates: aaPointsReport,
            color: "rgba(255, 0, 0, 0.25)",
            lineColor: "red",
            lineWidth: 2,
          },
        ]}
        annotations={aaPointsReport.map((point) => ({
          coordinates: point,
          icon: pointImage ? pointImage : undefined,
        }))}
        cameraPosition={{
          coordinates: {
            // Default coordinates for UT Tower
            // longitude: -97.73921,
            // latitude: 30.28565,

            // Testing camera position for test avoidance area
            longitude: -97.7333,
            latitude: 30.2672,
          },
          zoom: 16,
        }}
      />

      {isReportMode ? (
        <>
          {/* Report mode overlay tint */}
          <View className="pointer-events-none absolute bottom-0 left-0 right-0 top-0 bg-ut-blue/15" />
          {/* Report Mode Dialog */}
          <ReportModal
            className={`absolute left-10 right-10`}
            style={{
              top: insets.top + 25,
            }}
            aaPoints={aaPointsReport}
            currentStep={reportStep}
            setAAPoints={(points) => setAAPointsReport(points)}
            setCurrentStep={(index) => setReportStep(index)}
            onSubmit={(data) => {
              console.log("Submitting report:", data);
            }}
            onExit={() => {
              setIsReportMode(false);
            }}
          />
        </>
      ) : (
        // Bottom right button to enter report mode
        <Button
          className="absolute bottom-4 right-4"
          title={"Report"}
          onPress={() => setIsReportMode(true)}
        />
      )}
    </>
  );
}

