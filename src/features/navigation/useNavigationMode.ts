import { useCallback, useEffect, useRef, useState } from "react";
import type { Polygon } from "geojson";
import * as MapConstants from "~/src/features/map/constants";
import { fetchRoute, type ORSRoute, type RoutingProfile } from "~/utils/openRouteService";

// Lazy getter so Metro never tries to statically resolve expo-speech at bundle time.
// If the package isn't installed the no-op fallback is used and voice is silently disabled.
type SpeechModule = { speak: (t: string, o?: object) => void; stop: () => void };

function getSpeech(): SpeechModule {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-speech") as SpeechModule;
  } catch {
    return { speak: () => {}, stop: () => {} };
  }
}

export interface NavigationState {
  isNavigating: boolean;
  isLoading: boolean;
  route: ORSRoute | null;
  currentStepIndex: number;
  destinationName: string;
  destinationCoords: [number, number] | null;
  userPosition: [number, number];
  isMuted: boolean;
  profile: RoutingProfile;
  error: string | null;
}

export function useNavigationMode(avoidPolygons?: Polygon[]) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [route, setRoute] = useState<ORSRoute | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [destinationName, setDestinationName] = useState("");
  const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [profile, setProfile] = useState<RoutingProfile>("wheelchair");
  const [error, setError] = useState<string | null>(null);

  // Placeholder position — UT Tower. Swap for expo-location later.
  const userPosition: [number, number] = MapConstants.UT_TOWER;

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const avoidPolygonsRef = useRef(avoidPolygons);
  avoidPolygonsRef.current = avoidPolygons;

  // Announce each new step
  useEffect(() => {
    if (!isNavigating || !route) return;
    const step = route.steps[currentStepIndex];
    if (!step || isMutedRef.current) return;
    getSpeech().stop();
    getSpeech().speak(step.instruction, { language: "en-US", rate: 0.9, pitch: 1.0 });
  }, [currentStepIndex, isNavigating, route]);

  const startNavigation = useCallback(
    async (
      coords: [number, number],
      name: string,
      selectedProfile?: RoutingProfile,
      previewRoute?: ORSRoute,
    ) => {
      const activeProfile = selectedProfile ?? profile;
      if (selectedProfile) setProfile(selectedProfile);
      if (previewRoute) {
        // Skip fetch — use the already-loaded preview route
        setRoute(previewRoute);
        setDestinationName(name);
        setDestinationCoords(coords);
        setCurrentStepIndex(0);
        setIsNavigating(true);
        if (!isMutedRef.current && previewRoute.steps.length > 0) {
          getSpeech().stop();
          getSpeech().speak(
            `Starting navigation to ${name}. ${previewRoute.steps[0].instruction}`,
            { language: "en-US", rate: 0.9, pitch: 1.0 },
          );
        }
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchRoute([userPosition, coords], activeProfile, avoidPolygonsRef.current);
        setRoute(result);
        setDestinationName(name);
        setDestinationCoords(coords);
        setCurrentStepIndex(0);
        setIsNavigating(true);
        if (!isMutedRef.current && result.steps.length > 0) {
          getSpeech().stop();
          getSpeech().speak(
            `Starting navigation to ${name}. ${result.steps[0].instruction}`,
            { language: "en-US", rate: 0.9, pitch: 1.0 },
          );
        }
      } catch (e: any) {
        setError(e?.message ?? "Could not fetch route");
      } finally {
        setIsLoading(false);
      }
    },
    [userPosition, profile],
  );

  const endNavigation = useCallback(() => {
    getSpeech().stop();
    setIsNavigating(false);
    setRoute(null);
    setCurrentStepIndex(0);
    setDestinationName("");
    setDestinationCoords(null);
    setError(null);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      if (!prev) getSpeech().stop();
      return !prev;
    });
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStepIndex((i) => Math.min(i + 1, (route?.steps.length ?? 1) - 1));
  }, [route]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  return {
    state: {
      isNavigating,
      isLoading,
      route,
      currentStepIndex,
      destinationName,
      destinationCoords,
      userPosition,
      isMuted,
      profile,
      error,
    } satisfies NavigationState,
    action: { startNavigation, endNavigation, toggleMute, setProfile, nextStep, prevStep },
  };
}
