// TanStack Query hooks for the Hono backend
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Polygon } from "geojson";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { apiClient } from "./api-client";

const TOAST_MESSAGES = {
  reviewSubmitted: "Thank you for your review! Your insights are helpful in shaping the community's experience.",
  reviewDeleted: "Review deleted successfully!",
  avoidanceAreaSubmitted: "Thank you for your review! Your insights are helpful in shaping the community's experience.",
} as const;

// Query Keys
export const queryKeys = {
  pois: ["pois"] as const,
  avoidanceAreas: ["avoidanceAreas"] as const,
  constructionAreas: ["constructionAreas"] as const,
  avoidanceArea: (id: string) => ["avoidanceArea", id] as const,
  avoidanceAreaReports: (id: string) => ["avoidanceAreaReports", id] as const,
  profile: (id: number) => ["profile", id] as const,
  myProfile: ["myProfile"] as const,
  review: (poi_id: number) => ["review", poi_id] as const,
  reviewById: (id: number) => ["reviewById", id] as const,
  votes: (review_id: number) => ["votes", review_id] as const,
};


// get route between 2+ points
export async function getRoute(waypoints: any[], avoiding: any[]) {
  // TODO implement caching later
    return await apiClient.getRoute(waypoints, avoiding)
}


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


// fetch all construction areas
export function useConstructionAreas() {
  // just fetch every time for now, not caching
  return useQuery({
    queryKey: queryKeys.constructionAreas,
    queryFn: () => apiClient.getConstructionAreas(),
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

// fetch current active profile
export function useMyProfile() {
  return useQuery({
    queryKey: queryKeys.myProfile,
    queryFn: () => apiClient.getMyProfile(),
  });
}

// fetch reviews list by POI ID
export function useReviews(poi_id: number) {
  return useQuery({
    queryKey: queryKeys.review(poi_id),
    queryFn: () => apiClient.getReviews(poi_id),
    enabled: !!poi_id,
    retry: false,
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

  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      boundary_geojson: Polygon;
    }) => apiClient.insertAvoidanceArea(data),
    onSuccess: () => {
      // Invalidate and refetch avoidance areas
      queryClient.invalidateQueries({ queryKey: queryKeys.avoidanceAreas });

      Toast.show({
        type: "success",
        text2: TOAST_MESSAGES.avoidanceAreaSubmitted,
        topOffset: insets.top + 35,
      });
    },
    onError: (error) => {
      Toast.show({
        type: "error",
        text2: `Error reporting avoidance area: ${error.message}`,
        position: "bottom",
        bottomOffset: 40 * 3,
      });
    },
  });
}

// insert a new avoidance area report
export function useInsertAvoidanceAreaReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
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

// insert a new review
export function useInsertReview() {
  const queryClient = useQueryClient();
  // const bottomTabBarHeight = useBottomTabBarHeight();

  return useMutation({
    mutationFn: (data: {
      user_id: number;
      poi_id: number;
      rating: number;
      features?: string;
      content?: string;
    }) => apiClient.insertReview(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.review(variables.poi_id),
      }); // refetch reviews

      Toast.show({
        type: "success",
        text2:
          TOAST_MESSAGES.reviewSubmitted,
        position: "bottom",
        bottomOffset: 40 * 3,
      });
    },
    onError: (error) => {
      Toast.show({
        type: "error",
        text2: `Error submitting review: ${error.message}`,
        position: "bottom",
        bottomOffset: 40 * 3,
      });
    },
  });
}

// update an existing review
export function useUpdateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      id: number;
      poi_id: number;
      rating: number;
      features?: string;
      content?: string;
    }) => {
      const { id, ...payload } = data;
      return apiClient.updateReview(id, payload);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.review(variables.poi_id),
      }); // refetch reviews

      Toast.show({
        type: "success",
        text2:
          TOAST_MESSAGES.reviewSubmitted,
        position: "bottom",
        bottomOffset: 40 * 3,
      });
    },
    onError: (error) => {
      Toast.show({
        type: "error",
        text2: `Error modifying review: ${error.message}`,
        position: "bottom",
        bottomOffset: 40 * 3,
      });
    },
  });
}

// soft delete an existing review
export function useDeleteReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { id: number; poi_id: number }) =>
      apiClient.deleteReview(data.id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.review(variables.poi_id),
      }); // refetch reviews

      Toast.show({
        type: "success",
        text2: TOAST_MESSAGES.reviewDeleted,
        position: "bottom",
        bottomOffset: 40 * 3,
      });
    },
    onError: (error) => {
      Toast.show({
        type: "error",
        text2: `Error deleting review: ${error.message}`,
        position: "bottom",
        bottomOffset: 40 * 3,
      });
    },
  });
}

// upsert a vote on a specified review
export function useUpsertVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { review_id: number, vote: 1 | -1 }) =>
      apiClient.upsertVote(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["review"],
      }); // refetch review lists with vote counts

      console.log(`[useUpsertVote] Vote upserted for review with id ${variables.review_id}!`);
    },
    onError: (error) => {
      console.log(`[useUpsertVote] Error upserting vote: ${error.message}`);
    }
  });
}

// delete a vote from a specified review
export function useDeleteVote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (review_id: number) =>
      apiClient.deleteVote(review_id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["review"],
      }); // refetch review lists with vote counts

      console.log(`[useUpsertVote] Vote deleted for review with id ${variables}!`);
    },
    onError: (error) => {
      console.log(`[useUpsertVote] Error deleting vote: ${error.message}`);
    }
  })
}
