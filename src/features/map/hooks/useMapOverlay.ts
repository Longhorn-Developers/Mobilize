/**
 * Manages the overlay epoch/guard system for the map screen.
 *
 * Every time a bottom sheet opens, it captures a snapshot.
 * Any async work started during that open checks `canPresent(epoch)` before
 * presenting, if the epoch has advanced (sheet closed/re-opened) the stale
 * action is silently dropped. This prevents race conditions where a slow network
 * request opens the wrong sheet after the user has already navigated away.
 *
 * `featureTappedRef` — set to true by ShapeSource.onPress to prevent the
 * parent MapView.onPress from also firing (double-tap guard).
 *
 * `OVERLAY_CLOSE_ANIMATION_MS` — matches the bottom sheet dismiss animation
 * duration; `isClosingRef` stays true for this window to block new opens.
 */
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

export const OVERLAY_CLOSE_ANIMATION_MS = 220;

type UseMapOverlayOptions = {
  isTabFocused: boolean;
  /** Called by closeAllSheets to dismiss every bottom sheet ref. */
  onDismissSheets: () => void;
  /** Called by closeAllSheets to reset search / report UI state. */
  onResetUiState: () => void;
};

export function useMapOverlay({
  isTabFocused,
  onDismissSheets,
  onResetUiState,
}: UseMapOverlayOptions) {
  const overlayEpochRef = useRef(0);
  const isClosingRef = useRef(false);
  const featureTappedRef = useRef(false);
  const isScreenActiveRef = useRef(isTabFocused);
  const overlayResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllersRef = useRef<Set<AbortController>>(new Set());

  const abortAllPendingActions = useCallback(() => {
    abortControllersRef.current.forEach((controller) => {
      try { controller.abort(); } catch { /* ignore individual abort failures */ }
    });
    abortControllersRef.current.clear();
  }, []);

  const registerAbortController = useCallback(() => {
    const controller = new AbortController();
    abortControllersRef.current.add(controller);
    return controller;
  }, []);

  const releaseAbortController = useCallback((controller: AbortController) => {
    abortControllersRef.current.delete(controller);
  }, []);

  /** Captures the current epoch. Pass the return value to canPresent / guardedPresent. */
  const beginOverlayAction = useCallback(() => overlayEpochRef.current, []);

  /** Returns true only if the screen is active, not currently closing, and the epoch hasn't advanced. */
  const canPresent = useCallback((epoch: number) => {
    return (
      isScreenActiveRef.current &&
      !isClosingRef.current &&
      epoch === overlayEpochRef.current
    );
  }, []);

  /** Calls presentFn only if canPresent passes; logs a debug trace in dev. */
  const guardedPresent = useCallback(
    (epoch: number, presentFn: () => void, actionName: string) => {
      if (!canPresent(epoch)) {
        if (__DEV__) {
          console.log(
            `[overlay] open_blocked_stale action=${actionName} epoch=${epoch} current=${overlayEpochRef.current}`,
          );
        }
        return false;
      }
      presentFn();
      if (__DEV__) {
        console.log(`[overlay] open_attempt action=${actionName} epoch=${epoch}`);
      }
      return true;
    },
    [canPresent],
  );

  const closeAllSheets = useCallback(() => {
    overlayEpochRef.current += 1;
    isClosingRef.current = true;
    abortAllPendingActions();
    if (overlayResetTimerRef.current) {
      clearTimeout(overlayResetTimerRef.current);
      overlayResetTimerRef.current = null;
    }
    onDismissSheets();
    onResetUiState();

    if (__DEV__) {
      console.log(`[overlay] closed_all epoch=${overlayEpochRef.current}`);
    }

    overlayResetTimerRef.current = setTimeout(() => {
      isClosingRef.current = false;
      overlayResetTimerRef.current = null;
    }, OVERLAY_CLOSE_ANIMATION_MS);
  }, [abortAllPendingActions, onDismissSheets, onResetUiState]);

  useFocusEffect(
    useCallback(() => {
      isScreenActiveRef.current = true;
      isClosingRef.current = false;
      return () => {
        isScreenActiveRef.current = false;
        closeAllSheets();
      };
    }, [closeAllSheets]),
  );

  useEffect(() => {
    isScreenActiveRef.current = isTabFocused;
    if (isTabFocused) return;
    closeAllSheets();
  }, [isTabFocused, closeAllSheets]);

  useEffect(() => {
    return () => {
      if (overlayResetTimerRef.current)
      {
        clearTimeout(overlayResetTimerRef.current);
      }
      abortAllPendingActions();
      isScreenActiveRef.current = false;
    };
  }, [abortAllPendingActions]);

  return {
    overlayEpochRef, featureTappedRef, isClosingRef,
    beginOverlayAction, canPresent, guardedPresent,
    registerAbortController, releaseAbortController,
    abortAllPendingActions, closeAllSheets,
  };
}
