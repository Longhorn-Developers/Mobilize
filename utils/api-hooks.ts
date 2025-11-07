// TanStack Query hooks for the Hono backend
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Polygon } from "geojson";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { apiClient } from "./api-client";

// Query Keys
export const queryKeys = {
  pois: ["pois"] as const,
  avoidanceAreas: ["avoidanceAreas"] as const,
  avoidanceArea: (id: string) => ["avoidanceArea", id] as const,
  avoidanceAreaReports: (id: string) => ["avoidanceAreaReports", id] as const,
  profile: (id: number) => ["profile", id] as const,
};

// fetch all POIs
export function usePOIs() {
  return useQuery({
    queryKey: queryKeys.pois,
    queryFn: () => apiClient.getPOIs(),
    staleTime: 1000 * 60 * 60 * 24, // 24 hour
  });
}

// fetch all avoidance areas
export function useAvoidanceAreas() {
  return useQuery({
    queryKey: queryKeys.avoidanceAreas,
    queryFn: () => apiClient.getAvoidanceAreas(),
  });
}

// fetch a single avoidance area with profile info
export function useAvoidanceArea(id: string) {
  return useQuery({
    queryKey: queryKeys.avoidanceArea(id),
    queryFn: () => apiClient.getAvoidanceArea(id),
    enabled: !!id,
  });
}

// fetch reports for an avoidance area
export function useAvoidanceAreaReports(id: string) {
  return useQuery({
    queryKey: queryKeys.avoidanceAreaReports(id),
    queryFn: () => apiClient.getAvoidanceAreaReports(id),
    enabled: !!id,
  });
}

// fetch a profile by ID
export function useProfile(id: number) {
  return useQuery({
    queryKey: queryKeys.profile(id),
    queryFn: () => apiClient.getProfile(id),
    enabled: !!id, // Only run if id is provided
  });
}

// health check
export function useHealthCheck() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => apiClient.healthCheck(),
    retry: 3,
    retryDelay: 1000,
  });
}

// insert a new avoidance area
export function useInsertAvoidanceArea() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const bottomTabBarHeight = useBottomTabBarHeight();

  return useMutation({
    mutationFn: (data: {
      user_id: number;
      name: string;
      description?: string;
      boundary_geojson: Polygon;
    }) => apiClient.insertAvoidanceArea(data),
    onSuccess: () => {
      // Invalidate and refetch avoidance areas
      queryClient.invalidateQueries({ queryKey: queryKeys.avoidanceAreas });

      Toast.show({
        type: "success",
        text2:
          "Thank you for your review! Your insights are helpful in shaping thecommunity’s experience.",
        topOffset: insets.top + 35,
      });
    },
    onError: (error) => {
      Toast.show({
        type: "error",
        text2: `Error reporting avoidance area: ${error.message}`,
        position: "bottom",
        bottomOffset: bottomTabBarHeight + 50,
      });
    },
  });
}

// insert a new avoidance area report
export function useInsertAvoidanceAreaReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      user_id: number;
      avoidance_area_id: string;
      title: string;
      description?: string;
    }) => apiClient.insertAvoidanceAreaReport(data),
    onSuccess: (data) => {
      // Locally update the avoidance area reports cache without refetching
      queryClient.setQueryData(
        queryKeys.avoidanceAreaReports(data[0].avoidance_area_id.toString()),
        (oldData: any) => [...(oldData || []), data[0]],
      );

      console.log(
        "Report added successfully",
        queryKeys.avoidanceAreaReports(data[0].avoidance_area_id.toString()),
      );
    },
    onError: (error) => {
      console.error("Error adding report:", error);
    },
  });
}
