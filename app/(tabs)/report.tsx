import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import MapView, { Polygon } from "react-native-maps";
import { useQuery } from "@supabase-cache-helpers/postgrest-react-query";
import { supabase } from "~/utils/supabase";
import { View, Text, TextInput, Modal, Button, StyleSheet } from 'react-native';
import AddAAPopup from "~/components/AddAAPopup";
import AAInfoPopup from "~/components/AAInfoPopup";


export default function Home() {

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAAID, setSelectedAAID] = useState('');
  const [selectedAAName, setSelectedAAName] = useState('');
  
  // Use the proper query key format that matches what we invalidate in AddAAPopup
  const { data: avoidanceAreas, isLoading, error } = useQuery(
    supabase
      .from("avoidance_areas_with_geojson")
      .select("id,name,boundary")
  );






  const handleAAInteraction = async (id: string): Promise<void> => {
          const { data: avoidanceAreaName, error } = await supabase
          .from("avoidance_areas_with_geojson")
          .select("name")
          .eq("id", id)
          .single();
  
          if (error) {
          console.log(error.message);
          return;
          }
  
          console.log("AA pressed:", avoidanceAreaName);
          setSelectedAAID(id);
          if (avoidanceAreaName.name) setSelectedAAName(avoidanceAreaName.name);
          setShowDetailModal(true);
      };


  

  useEffect(() => {
    console.log(
      "Fetched avoidance areas:",
      avoidanceAreas?.map((area) => area.name),
    );
  }, [avoidanceAreas]);

  return (
    <>
      <Stack.Screen options={{ title: "Report", headerShown: false }} />
      <AddAAPopup/>
      
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          // Default coordinates for UT Tower
          // longitude: -97.73921,
          // latitude: 30.28565,

          // Coordinates for testing seed avoidance area
          longitude: -97.7333,
          latitude: 30.2672,

          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {avoidanceAreas &&
          avoidanceAreas.map((area) => (
            <Polygon
              key={area.id}
              coordinates={
                area.boundary?.coordinates[0].map(([longitude, latitude]) => ({
                  latitude,
                  longitude,
                })) || []
              }
              strokeColor="rgba(255, 0, 0, 0.5)"
              fillColor="rgba(255, 0, 0, 0.25)"
              strokeWidth={2}
              onPress = {() => handleAAInteraction(area.id!)}
            />
          ))}
      </MapView>
      
      <AAInfoPopup
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        selectedAAID={selectedAAID}
        selectedAAName={selectedAAName}
      />
      
      
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  popup: {
    backgroundColor: 'white',
    marginHorizontal: 30,
    padding: 20,
    borderRadius: 10,
    elevation: 10,
  },
  input: {
    borderBottomWidth: 1,
    marginBottom: 10,
    paddingVertical: 5,
  },
});