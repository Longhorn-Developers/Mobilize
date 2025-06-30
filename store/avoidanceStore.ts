import { create } from "zustand";
import { Tables } from "~/types/database";
import { supabase } from "~/utils/supabase";

export interface AvoidanceAreasState {
  avoidanceAreas: Tables<"avoidance_areas_with_geojson">[];
  avoidanceAreasLoading: boolean;

  // Actions
  fetchAvoidanceAreas: () => Promise<void>;
}

export const useAvoidanceStore = create<AvoidanceAreasState>((set) => ({
  avoidanceAreas: [],
  avoidanceAreasLoading: false,

  fetchAvoidanceAreas: async () => {
    try {
      set({ avoidanceAreasLoading: true });

      const { data, error } = await supabase
        .from("avoidance_areas_with_geojson")
        .select("*");

      if (error) {
        console.error("Error fetching avoidance areas:", error);
        throw error;
      }

      console.log("Fetched avoidance areas");
      set({ avoidanceAreas: data || [] });
    } catch (error) {
      console.error("Failed to fetch avoidance areas:", error);
      throw error;
    } finally {
      set({ avoidanceAreasLoading: false });
    }
  },
}));
