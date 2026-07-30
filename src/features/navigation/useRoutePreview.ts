import { useCallback, useRef, useState } from "react";
import type { Polygon } from "geojson";

import * as MapConstants from "~/src/features/map/constants";
import { fetchRoute, type ORSRoute, type RoutingProfile } from "~/utils/openRouteService";

export interface RouteStop {
  coords: [number, number];
  name: string;
}

export interface RoutePreviewState {
  isOpen: boolean;
  isLoading: boolean;
  route: ORSRoute | null;
  error: string | null;
  destinationName: string;
  destinationCoords: [number, number] | null;
  entranceLabel: string;
  originName: string;
  originCoords: [number, number];
  profile: RoutingProfile;
  stops: RouteStop[];
  showDirectionsList: boolean;
}

export function useRoutePreview(avoidPolygons?: Polygon[]) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [route, setRoute] = useState<ORSRoute | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [destinationName, setDestinationName] = useState("");
  const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null);
  const [entranceLabel, setEntranceLabel] = useState("");
  const [originName, setOriginName] = useState("My Location");
  const [originCoords, setOriginCoords] = useState<[number, number]>(MapConstants.UT_TOWER);
  const [profile, setProfile] = useState<RoutingProfile>("wheelchair");
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [showDirectionsList, setShowDirectionsList] = useState(false);

  const fetchIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const avoidPolygonsRef = useRef(avoidPolygons);
  avoidPolygonsRef.current = avoidPolygons;

  const doFetch = useCallback(
    async (
      origin: [number, number],
      destination: [number, number],
      activeProfile: RoutingProfile,
      activeStops: RouteStop[],
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const id = ++fetchIdRef.current;

      setIsLoading(true);
      setError(null);

      // Route order: Origin → Destination → Stops (stops visited after destination)
      const waypoints: [number, number][] = [origin, destination, ...activeStops.map((s) => s.coords)];

      try {
        const result = await fetchRoute(waypoints, activeProfile, avoidPolygonsRef.current);
        if (id === fetchIdRef.current && !controller.signal.aborted) {
          setRoute(result);
        }
      } catch (e: any) {
        if (id === fetchIdRef.current && !controller.signal.aborted) {
          setError(e?.message ?? "Could not fetch route");
        }
      } finally {
        if (id === fetchIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  const openPreview = useCallback(
    (coords: [number, number], name: string, entrance = "") => {
      setDestinationCoords(coords);
      setDestinationName(name);
      setEntranceLabel(entrance);
      setStops([]);
      setShowDirectionsList(false);
      setRoute(null);
      setError(null);
      setIsOpen(true);
      void doFetch(MapConstants.UT_TOWER, coords, profile, []);
    },
    [profile, doFetch],
  );

  const closePreview = useCallback(() => {
    abortRef.current?.abort();
    setIsOpen(false);
    setRoute(null);
    setError(null);
    setDestinationName("");
    setDestinationCoords(null);
    setEntranceLabel("");
    setOriginName("My Location");
    setOriginCoords(MapConstants.UT_TOWER);
    setProfile("wheelchair");
    setStops([]);
    setShowDirectionsList(false);
  }, []);

  const changeProfile = useCallback(
    (p: RoutingProfile) => {
      setProfile(p);
      if (destinationCoords) {
        void doFetch(originCoords, destinationCoords, p, stops);
      }
    },
    [destinationCoords, originCoords, stops, doFetch],
  );

  const setOrigin = useCallback(
    (coords: [number, number], name: string) => {
      setOriginCoords(coords);
      setOriginName(name);
      if (destinationCoords) {
        void doFetch(coords, destinationCoords, profile, stops);
      }
    },
    [destinationCoords, profile, stops, doFetch],
  );

  const setDestination = useCallback(
    (coords: [number, number], name: string) => {
      setDestinationCoords(coords);
      setDestinationName(name);
      void doFetch(originCoords, coords, profile, stops);
    },
    [originCoords, profile, stops, doFetch],
  );

  const swapOriginDest = useCallback(() => {
    if (!destinationCoords) return;
    const newOriginCoords = destinationCoords;
    const newOriginName = destinationName;
    const newDestCoords = originCoords;
    const newDestName = originName;
    setOriginCoords(newOriginCoords);
    setOriginName(newOriginName);
    setDestinationCoords(newDestCoords);
    setDestinationName(newDestName);
    void doFetch(newOriginCoords, newDestCoords, profile, stops);
  }, [destinationCoords, destinationName, originCoords, originName, profile, stops, doFetch]);

  const addStop = useCallback(
    (coords: [number, number], name: string) => {
      const newStop: RouteStop = { coords, name };
      setStops((prev) => {
        const updated = [...prev, newStop];
        if (destinationCoords) void doFetch(originCoords, destinationCoords, profile, updated);
        return updated;
      });
    },
    [destinationCoords, originCoords, profile, doFetch],
  );

  const removeStop = useCallback(
    (index: number) => {
      setStops((prev) => {
        const updated = prev.filter((_, i) => i !== index);
        if (destinationCoords) void doFetch(originCoords, destinationCoords, profile, updated);
        return updated;
      });
    },
    [destinationCoords, originCoords, profile, doFetch],
  );

  const toggleDirectionsList = useCallback(() => {
    setShowDirectionsList((prev) => !prev);
  }, []);

  return {
    state: {
      isOpen,
      isLoading,
      route,
      error,
      destinationName,
      destinationCoords,
      entranceLabel,
      originName,
      originCoords,
      profile,
      stops,
      showDirectionsList,
    } satisfies RoutePreviewState,
    action: {
      openPreview,
      closePreview,
      changeProfile,
      setOrigin,
      setDestination,
      swapOriginDest,
      addStop,
      removeStop,
      toggleDirectionsList,
    },
  };
}
