import { Coordinates } from "expo-maps";
import { supabase } from "./supabase";

function coordinatesToWKT(coordinates: Coordinates[]): string {
  // Convert coordinates to "longitude latitude" format
  const points = coordinates
    .map((coord) => `${coord.longitude} ${coord.latitude}`)
    .join(", ");

  // Wrap in POLYGON format
  return `POLYGON((${points}))`;
}

export async function insertAvoidanceArea(name: string, coordinates: Coordinates[]) {
  try {
    const wkt = coordinatesToWKT(coordinates);

    const { data, error } = await supabase.rpc("insert_avoidance_area", {
      p_name: name,
      p_wkt: wkt,
    });

    if (error) {
      console.error("Error adding avoidance zone:", error);
      throw error;
    }

    console.log("Successfully added avoidance zone with ID:", data);
    return data;
  } catch (error) {
    console.error("Failed to add avoidance zone:", error);
    throw error;
  }
}
