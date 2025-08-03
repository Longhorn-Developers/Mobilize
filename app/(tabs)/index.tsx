import { Stack } from "expo-router";
import { useState, useEffect } from "react";
import { View } from "react-native";
import MapView, {
  Polygon,
  Marker,
  Region,
  type LatLng,
  type MapPressEvent,
} from "react-native-maps";
import { useQuery } from "@supabase-cache-helpers/postgrest-react-query";
import { supabase } from "~/utils/supabase";
import { Button } from "~/components/Button";
import { ReportModal } from "~/components/ReportModal";
import { useInsertMutation } from '@supabase-cache-helpers/postgrest-react-query'

import { useQueryClient, useMutation } from '@tanstack/react-query';

import { lineIntersect } from "@turf/line-intersect";
import { feature, lineString } from '@turf/helpers';

import * as turf from '@turf/turf';
import { LineString } from "geojson";

export const useInsertAvoidanceAreaRPC = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({name, wkt}: {name:string, wkt:string}) => {
      const {data, error} = await supabase.rpc('insert_avoidance_area', {
        p_name:name,
        p_wkt:wkt,
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
  const [isReportMode, setIsReportMode] = useState(false);
  const [aaPoints, setAAPoints] = useState<LatLng[]>([]);
  
  const [aaLines, setAALines] = useState([]);
  const { mutateAsync: insertAA, isPending, error } = useInsertAvoidanceAreaRPC();
  const { mutateAsync: insertAADetails} = insertAvoidanceAreaDetailsRPC();
  const [description, setDescription] = useState("");


  const [intersectionPoints, setIntersectionPoints] = useState<LatLng[]>([]);
  

  const { data: avoidanceAreas } = useQuery(
    supabase.from("avoidance_areas_with_geojson").select("id,name,boundary"),
  );
  

  const addAvoidanceZone = async (name: string, description: string, coordinates: LatLng[]) => {
      try {
        //first check if enough points have been added
        if (aaPoints.length < 3){
          console.log("Error: Not enough points have been added. Add at least 3");
          return;
        }
        //final line validation before proceeding
        const currentLine = turf.lineString([[aaPoints[0].longitude, aaPoints[0].latitude], [aaPoints[aaPoints.length-1].longitude, aaPoints[aaPoints.length-1].latitude]]);
        console.log("Is valid?:", isValidLine(aaLines, currentLine));


        coordinates = [...coordinates, coordinates[0]]; // Autofill the border to the start
        //console.log("About to change coords to WKT: ", coordinates);
        const wkt = coordinatesToWKT(coordinates);
        //console.log("Finished changing coords to WKT: ", wkt);

        //const initial_insert_data = await handleAddAA(name, wkt);
        const initial_insert_data = await insertAA({name, wkt});
        const detailed_insert_data = await insertAADetails({name, description, id:initial_insert_data}) //initial insert_data acts as the AA ID passed to the new rpc function

        

        console.log("Successfully added avoidance zone with ID:", detailed_insert_data);
        setAAPoints([]);
        setIntersectionPoints([]);
        setAALines([]);
        setIsReportMode(false);
        return detailed_insert_data;
      } catch (error: any) {
        console.error("Failed to add avoidance zone:", error);
        if (error.details) console.error("Details:", error.details);
        if (error.hint) console.error("Hint:", error.hint);
        setAAPoints([]);
        setIntersectionPoints([]);
        setAALines([]);
        setIsReportMode(false);
        throw error;
      }
    };

  // Add pressed coordinates to marked points
  const handleMapPress = (event: MapPressEvent) => {
    if (
      !isReportMode ||
      !event.nativeEvent.coordinate ||
      aaPoints.some(
        (pt) =>
          pt.latitude === event.nativeEvent.coordinate.latitude &&
          pt.longitude === event.nativeEvent.coordinate.longitude
      )
      
    )
      return;

    event.persist();

    setAAPoints((prev) => [...(prev || []), event.nativeEvent.coordinate]);
    
    //addCoordinate(event.nativeEvent.coordinate.latitude, event.nativeEvent.coordinate.longitude);
    if (aaPoints.length > 0){
      const lineCoords = [[event.nativeEvent.coordinate.longitude, event.nativeEvent.coordinate.latitude], [aaPoints[aaPoints.length-1].longitude, aaPoints[aaPoints.length-1].latitude]];
      const currentLine = turf.lineString(lineCoords);

      //perform checks with current line
      //do what you will with the check (returns if the line is valid or not, and places a marker where it's invalid)
      console.log("Is valid?:", isValidLine(aaLines, currentLine));
      

      
      
    }
    
    
    
    
    
    
  };

  function isValidLine(lines: any[], current: LineString): boolean {
    //const newLine = lines[lines.length-1];
    let count = 0;
    for (let i = 0; i < lines.length; i++){
      console.log("Line to check:", lines[i]);
      var comparisonLine = lines[i];
      var intersects = turf.lineIntersect(current, comparisonLine);
      if (intersects.features.length > 0){
        console.log("aaPoints:",aaPoints);
        intersects.features.forEach((feature, index) => {
          const coords = feature.geometry.coordinates;
          console.log(`Intersection #${index + 1}: [${coords[0]}, ${coords[1]}]`);
          const temp_point: LatLng = {
            latitude: coords[1],
            longitude: coords[0]
          };
          console.log("Temp Point:", temp_point);
          const exists = aaPoints.some(
            p => p.latitude === temp_point.latitude && p.longitude === temp_point.longitude
          );
          if (exists === true){
            console.log("ENDPOINT INTERSECTION");
          }else{
            setIntersectionPoints((prev) => [...(prev || []), temp_point]);
            count++;
          }
          
        });
      }

      
      
      
    }

    const updatedLines = [...aaLines, current];
    setAALines(updatedLines);
    console.log(updatedLines);

    if (count > 0){
      return false;
    }else{
      return true;
    }
    
    

  }
  function coordinatesToWKT(coordinates: LatLng[]): string {
    // Convert coordinates to "longitude latitude" format
    //coordinates = [[-98.7333, 30.2672], [-98.7338, 30.2672], [-98.7338, 30.268], [-98.7333, 30.268], [-98.7333, 30.2672]]; //just to test
    const points = coordinates
      .map((coord) => `${coord.longitude} ${coord.latitude}`)
      .join(", ");

    // Wrap in POLYGON format
    return `POLYGON((${points}))`;
  }

  interface GeoJsonPolygon {
    type: 'Polygon';
    coordinates: [number, number][][];
  }

  /*
  const MarkerLayer = ({ points }: { points: LatLng[] }) => (
    <>
      {points.map((point, index) => (
        <Marker
          key={`${point.latitude}-${point.longitude}-${index}`}
          coordinate={point}
          pinColor="red"
        />
      ))}
    </>
  );

  const addCoordinate = (latitude:number, longitude:number) => {
    console.log("Adding coordinate:", latitude, longitude);
    return (
      <Marker
        key={`${latitude}-${longitude}`}
        coordinate={{
          latitude: latitude,
          longitude: longitude,
        }}
        pinColor="red"
      />
    );
  }

  const handleAddAA = async (name: string, wkt: string) => {
    const { data, error } = await supabase.rpc('insert_avoidance_area', {
      p_name: name,
      p_wkt: wkt,
    });

    if (error) {
      console.error('Insert failed:', error);
      return;
    }

    console.log('Inserted AA with ID:', data);
  };
  */

  

  /*
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('avoidance-areas-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'avoidance_areas' },
        (payload) => {
          const { id, name, boundary } = payload.new;
          console.log("Payload created:", id);
          

          queryClient.setQueryData(
            ['avoidance_area_reports'], // must match the key used by useQuery
            (oldData: any) => {
              if (!oldData) return [{ id, name, boundary }];
              return [...oldData, { id, name, boundary }];
            }
          );
          console.log();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
  */

  useEffect(()=> {
    if (aaPoints.length > 0){
      console.log("New point: ", aaPoints[aaPoints.length-1]);
    }

  }, [aaPoints]);

  const defaultRegion: Region = {
    longitude: -97.7333,
    latitude: 30.2672,

    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };
  const [region, setRegion] = useState<Region | null>(defaultRegion);
  return (
    <>
      <Stack.Screen options={{ title: "Home", headerShown: false }} />
      
        <MapView
          initialRegion={region!}
          onRegionChangeComplete={(currentRegion) => {
            setRegion(currentRegion);
          }}
          
          key = {aaPoints.length}
          showsMyLocationButton
          style={{ flex: 1 }}
          onPress={handleMapPress}
          
          
            
        >
          {/* Show avoidance area polygons */}
          {avoidanceAreas &&
            avoidanceAreas.map((area) => {
              const boundary = area.boundary as unknown as GeoJsonPolygon | undefined;
              return (
                <Polygon
                  key={area.id}
                  coordinates={
                    boundary?.coordinates[0].map(([longitude, latitude]) => ({
                      latitude,
                      longitude,
                    })) || []
                  }
                  strokeColor="rgba(255, 0, 0, 0.5)"
                  fillColor="rgba(255, 0, 0, 0.25)"
                  strokeWidth={2}
                />
              );
            })}

          {/* Show selected avoidance area coordinate points */}
          
          
          {aaPoints &&
          aaPoints.map((point) => (
            <Marker
              key={`${point.latitude}-${point.longitude}`}
              coordinate={{
                latitude: point.latitude,
                longitude: point.longitude,
              }}
              pinColor="red"
            />
          ))}
          {intersectionPoints &&
          intersectionPoints.map((point) => (
            <Marker
              key={`${point.latitude}-${point.longitude}`}
              coordinate={{
                latitude: point.latitude,
                longitude: point.longitude,
              }}
              pinColor="green"
            />
          ))}
          
        </MapView>
      

      {/* Report mode overlay tint */}
      {isReportMode && (
        <View className="bg-ut-blue/15 pointer-events-none absolute bottom-0 left-0 right-0 top-0" />
      )}

      {/* Bottom right button to enter report mode */}
      <Button
        className="absolute bottom-4 right-4"
        title={isReportMode ? "Exit Report" : "Report"}
        onPress={() => {
          setAAPoints([]);
          setIntersectionPoints([]);
          setAALines([]);
          setDescription("");
          setIsReportMode(!isReportMode);
        }}
      />

      {/* Report Mode Dialog */}
      {isReportMode && (
        <ReportModal
          className="absolute left-12 right-12 top-20"
          isVisible={isReportMode}
          aaPoints={aaPoints}
          description={description}
          onDescriptionChange={setDescription}   // will update parent state
          onSubmit={() => {
            console.log("Submitting avoidance area points:", aaPoints);
            console.log("Description:", description);
            addAvoidanceZone("test", description, aaPoints);
            setIsReportMode(false);
          }}
          onClearPoints={() => {setAAPoints([]); setAALines([]); setIntersectionPoints([]);}}
        />
      )}
    </>
  );
}
