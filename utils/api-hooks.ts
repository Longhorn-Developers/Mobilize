// TanStack Query hooks for the Hono backend
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { apiClient } from "./api-client";
import { Polygon } from "geojson";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

// Query Keys
export const queryKeys = {
  pois: ["pois"] as const,
  avoidanceAreas: ["avoidanceAreas"] as const,
  avoidanceArea: (id: number | string) => ["avoidanceArea", id] as const,
  avoidanceAreaReports: (id: number | string) =>
    ["avoidanceAreaReports", id] as const,
  profile: (id: number) => ["profile", id] as const,
};

// fetch all POIs
export function usePOIs() {
  return useQuery({
    queryKey: queryKeys.pois,
    queryFn: () => apiClient.getPOIs(),
    staleTime: 1000 * 60 * 60, // 1 hour
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
export function useAvoidanceArea(id: number | string) {
  return useQuery({
    queryKey: queryKeys.avoidanceArea(id),
    queryFn: () => apiClient.getAvoidanceArea(Number(id)),
    enabled: !!id,
  });
}

// fetch reports for an avoidance area
export function useAvoidanceAreaReports(id: number | string) {
  return useQuery({
    queryKey: queryKeys.avoidanceAreaReports(id),
    queryFn: () => apiClient.getAvoidanceAreaReports(Number(id)),
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
