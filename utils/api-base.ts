/**
 * Shared API base URL resolution for the mobile client.
 *
 * All three HTTP clients (ApiClient, useAuth, googlePlaces) used to maintain
 * their own copy of this logic with separate activeApiUrl state. This module
 * is the single source of truth so that a URL promoted by any one client is
 * immediately available to the others.
 *
 * Usage:
 *   import { getApiBaseCandidates, promoteApiBaseUrl, resolveApiBaseUrl } from "~/utils/api-base";
 */

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  fetchWithTimeout,
  isRetriableCandidateError,
  parseJsonResponse,
} from "~/utils/request-utils";

const LOCAL_API_URL = "http://localhost:54321";
const CONFIGURED_API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").trim().replace(/\/$/, "");
const API_URL = CONFIGURED_API_URL || LOCAL_API_URL;

/** Deduplicated set of all candidate base URLs: configured URL first, then localhost fallback. */
export const API_BASE_CANDIDATES: readonly string[] = Array.from(
  new Set([API_URL, LOCAL_API_URL].map((url) => url.replace(/\/+$/, ""))),
).filter(Boolean);

// The most-recently-confirmed working base URL, tried first on every new request.
let activeApiUrl: string = API_BASE_CANDIDATES[0] ?? LOCAL_API_URL;

/**
 * Returns URL candidates to try in priority order.
 * The last known-good URL is always first; the rest follow in their original order.
 * Callers should iterate the list and call `promoteApiBaseUrl()` on success.
 */
export function getApiBaseCandidates(): string[] {
  return [
    activeApiUrl,
    ...API_BASE_CANDIDATES.filter((c) => c !== activeApiUrl),
  ];
}

/**
 * Marks a URL as the most-recently-confirmed working API base.
 * Call this after any candidate returns a valid JSON response.
 */
export function promoteApiBaseUrl(url: string): void {
  activeApiUrl = url;
}

/**
 * Probes the /health endpoint of each candidate in order and returns the first
 * reachable one. Falls back silently to the last active URL if all candidates fail.
 * Useful for flows (e.g. sign-out) that need a confirmed URL before making a single request.
 */
export async function resolveApiBaseUrl(): Promise<string> {
  let fallbackError: unknown = null;

  for (const candidate of getApiBaseCandidates()) {
    try {
      const healthUrl = `${candidate}/health`;
      const response = await fetchWithTimeout(healthUrl, undefined, DEFAULT_REQUEST_TIMEOUT_MS);
      // Any reachable JSON response confirms this is a valid API endpoint.
      await parseJsonResponse(response, healthUrl);
      promoteApiBaseUrl(candidate);
      return candidate;
    } catch (error) {
      fallbackError = error;
      if (!isRetriableCandidateError(error)) {
        break;
      }
    }
  }

  if (fallbackError) {
    console.warn("[api-base] Could not auto-resolve API base URL:", fallbackError);
  }
  return activeApiUrl;
}
