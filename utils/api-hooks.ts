// TanStack Query hooks for the Hono backend
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./api-client";

// Query Keys
export const queryKeys = {
  pois: ["pois"] as const,
  avoidanceAreas: ["avoidanceAreas"] as const,
  avoidanceArea: (id: number | string) => ["avoidanceArea", id] as const,
  avoidanceAreaReports: (id: number | string) =>
    ["avoidanceAreaReports", id] as const,
  profile: (id: number) => ["profile", id] as const,
};

// Hook to fetch all POIs
export function usePOIs() {
  return useQuery({
    queryKey: queryKeys.pois,
    queryFn: () => apiClient.getPOIs(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

// Hook to fetch all avoidance areas
export function useAvoidanceAreas() {
  return useQuery({
    queryKey: queryKeys.avoidanceAreas,
    queryFn: () => apiClient.getAvoidanceAreas(),
  });
}

// Hook to fetch a single avoidance area with profile info
export function useAvoidanceArea(id: number | string) {
  return useQuery({
    queryKey: queryKeys.avoidanceArea(id),
    queryFn: () => apiClient.getAvoidanceArea(Number(id)),
    enabled: !!id,
  });
}

// Hook to fetch reports for an avoidance area
export function useAvoidanceAreaReports(id: number | string) {
  return useQuery({
    queryKey: queryKeys.avoidanceAreaReports(id),
    queryFn: () => apiClient.getAvoidanceAreaReports(Number(id)),
    enabled: !!id,
  });
}

// Hook to fetch a profile by ID
export function useProfile(id: number) {
  return useQuery({
    queryKey: queryKeys.profile(id),
    queryFn: () => apiClient.getProfile(id),
    enabled: !!id, // Only run if id is provided
  });
}

// Hook for health check (useful for testing connection)
export function useHealthCheck() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => apiClient.healthCheck(),
    retry: 3,
    retryDelay: 1000,
  });
}
