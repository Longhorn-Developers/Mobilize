import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Modal, Button, StyleSheet} from 'react-native';
import { supabase } from "~/utils/supabase";
import { useInsertMutation } from '@supabase-cache-helpers/postgrest-react-query';
import { useQueryClient, useMutation } from '@tanstack/react-query';



type Coordinate = {
    longitude: number;
    latitude: number;
} //coordinates must be longitude, latitude

function coordinatesToWKT(coordinates: number[][]): string {
  // Convert coordinates to "longitude latitude" format
  //coordinates = [[-98.7333, 30.2672], [-98.7338, 30.2672], [-98.7338, 30.268], [-98.7333, 30.268], [-98.7333, 30.2672]]; //just to test
  const points = coordinates
    .map((coord) => `${coord[0]} ${coord[1]}`)
    .join(", ");

  // Wrap in POLYGON format
  return `POLYGON((${points}))`;
}

//NOTE TO SELF, REMOVE FETCH AND ALSO IN APP.JSON REMOVE INFOPLIST AND NSALLOWSARBITRARYLOADS, ITS UNSAFE FOR PRODUCTION


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
      queryClient.invalidateQueries({
        predicate: (query) => {
          console.log("Successfully invalidated query");
          return query.queryKey[0] === 'avoidance_areas_with_geojson';
          
        }
      });
    }
  });
};


const AddAAPopup = () => {
    const [modalVisible, setModalVisible] = useState(false);
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [coordinates, setCoordinates] = useState<[number, number][]>([]);


    const { mutateAsync: insertAA, isPending, error } = useInsertAvoidanceAreaRPC();

    const addAvoidanceZone = async (name: string, coordinates: number[][]) => {
      try {
        console.log("About to change coords to WKT: ", coordinates);
        const wkt = coordinatesToWKT(coordinates);
        console.log("Finished changing coords to WKT: ", wkt);

        const data = await insertAA({ name, wkt }); // ✅ This is now allowed

        console.log("Successfully added avoidance zone with ID:", data);
        setCoordinates([]);
        setModalVisible(false);
        return data;
      } catch (error: any) {
        console.error("Failed to add avoidance zone:", error);
        if (error.details) console.error("Details:", error.details);
        if (error.hint) console.error("Hint:", error.hint);
        setCoordinates([]);
        setModalVisible(false);
        throw error;
      }
    };


    
    
    
    const handleAddCoordinate = () => {
      const parsedLongitude = parseFloat(longitude);
      const parsedLatitude = parseFloat(latitude);
        if (!isNaN(parsedLongitude) && !isNaN(parsedLatitude)) {
            setCoordinates([...coordinates, [parsedLongitude, parsedLatitude]]);
            
            console.log("Longitude:", parsedLongitude);
            console.log("Latitude:", parsedLatitude);
            setLongitude('');
            setLatitude('');
            
            
        }
    }
    const clearCoordinates = () => {
        setCoordinates([]);
        console.log(coordinates);
    }

    async function handleSubmitCoordinates(coordinates: number[][]) {
      console.log("Setting avoidance area")
      coordinates.push(coordinates[0]);
      await addAvoidanceZone("Downtown Construction Zone", coordinates);
    }

    /*
    useEffect (() =>{
        fetch("https://f5f197b8af1a.ngrok-free.app/rest/v1/", {
            headers: {
                apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0",
                Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`,
            }
            })
            .then(r => r.text())
            .then(console.log)
            .catch(console.error);
    })v
    */ 
    
    return (
    <View style={styles.container}>
      <Button title="Add Coordinate" onPress={() => setModalVisible(true)} />
        

      <Modal
        transparent={true}
        animationType="slide"
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.popup}>
            
            <Text>Enter Latitude:</Text>
            <TextInput
              keyboardType='default'
              value={latitude}
              onChangeText={setLatitude}
            />

            <Text>Enter Longitude:</Text>
            <TextInput
              keyboardType='default'
              value={longitude}
              onChangeText={setLongitude}
            />


            


            

            <Button title="Add" onPress={handleAddCoordinate} />
            <Button title="Cancel" onPress={() => setModalVisible(false)} color="red" />
          </View>
        </View>
        
      </Modal>
        {coordinates.map((coord, idx) => (
            <Text key={idx}>
            Lng: {coord[0]}, Lat: {coord[1]}
            </Text>
        ))}
        <Button title="Clear" onPress={clearCoordinates} />
        <Button title="Submit" onPress={() => handleSubmitCoordinates(coordinates)} />
      
    </View>
  );
}

export default AddAAPopup;

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