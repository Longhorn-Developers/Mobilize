/**
 * Low-level HTTP utilities shared across all mobile API clients.
 *
 * Key exports:
 *  - `fetchWithTimeout`    — wraps fetch with an AbortController deadline
 *  - `parseJsonResponse`   — reads a Response as typed JSON, throwing on HTML / non-JSON / malformed
 *  - `ClientRequestError`  — typed error class for all network/API failures
 *  - `isRetriableCandidateError` — returns true when the error warrants trying the next URL candidate
 */

/** Milliseconds before a request is aborted with TIMEOUT. Increase for slow connections. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

export type ClientRequestErrorCode =
  | "TIMEOUT"
  | "NETWORK"
  | "NON_JSON"
  | "HTML_RESPONSE"
  | "MALFORMED_JSON"
  | "API_ERROR";

type ClientRequestErrorOptions = {
  status?: number;
  url?: string;
  responsePreview?: string;
  details?: unknown;
  cause?: unknown;
};

export class ClientRequestError extends Error {
  code: ClientRequestErrorCode;
  status?: number;
  url?: string;
  responsePreview?: string;
  details?: unknown;

  constructor(
    code: ClientRequestErrorCode,
    message: string,
    options: ClientRequestErrorOptions = {},
  ) {
    super(message);
    this.name = "ClientRequestError";
    this.code = code;
    this.status = options.status;
    this.url = options.url;
    this.responsePreview = options.responsePreview;
    this.details = options.details;
    if (options.cause !== undefined) {
      (this as any).cause = options.cause;
    }
  }
}

/** Returns true when the error was caused by a network outage or request timeout. */
export function isLikelyNetworkError(error: unknown) {
  if (error instanceof ClientRequestError) {
    return error.code === "TIMEOUT" || error.code === "NETWORK";
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /network request failed|failed to fetch|networkerror|timed out/i.test(message);
}

/**
 * Returns true when the error is worth retrying against a different URL candidate.
 * API_ERROR (4xx/5xx from a reachable server) is NOT retriable — the server responded,
 * so switching candidates would not help.
 */
export function isRetriableCandidateError(error: unknown) {
  return (
    error instanceof ClientRequestError &&
    (error.code === "TIMEOUT" ||
      error.code === "NETWORK" ||
      error.code === "HTML_RESPONSE" ||
      error.code === "NON_JSON" ||
      error.code === "MALFORMED_JSON")
  );
}

/**
 * Reads a Response body as JSON, throwing a typed ClientRequestError for HTML
 * responses, non-JSON content types, empty bodies, and malformed JSON.
 * This is the single canonical JSON-parsing helper — use it instead of
 * rolling per-module implementations.
 *
 * @param response  The fetch Response to parse.
 * @param urlForError  Optional URL string used in error messages (defaults to response.url).
 */
export async function parseJsonResponse<T>(response: Response, urlForError?: string): Promise<T> {
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  const body = await response.text().catch(() => "(unreadable body)");
  const preview = body.slice(0, 200) || response.statusText || "Empty response body";
  const requestUrl = urlForError ?? response.url;

  if (!contentType.includes("application/json")) {
    const isHtml = /<!doctype html|<html/i.test(body);
    throw new ClientRequestError(
      isHtml ? "HTML_RESPONSE" : "NON_JSON",
      isHtml
        ? `API returned HTML instead of JSON at ${requestUrl}. Check EXPO_PUBLIC_API_URL and tunnel/local API routing.`
        : `Non-JSON response (${response.status} ${response.statusText}): ${preview}`,
      { status: response.status, url: requestUrl, responsePreview: preview },
    );
  }

  const trimmed = body.trim();
  if (!trimmed) {
    return {} as T;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new ClientRequestError(
      "MALFORMED_JSON",
      `API returned malformed JSON (${response.status} ${response.statusText})`,
      { status: response.status, url: requestUrl, responsePreview: preview },
    );
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const mergedInit: RequestInit = {
    ...init,
    signal: controller.signal,
  };

  try {
    return await fetch(input, mergedInit);
  } catch (error) {
    if ((error as any)?.name === "AbortError") {
      throw new ClientRequestError(
        "TIMEOUT",
        `Request timed out after ${timeoutMs}ms`,
        { cause: error },
      );
    }
    throw new ClientRequestError("NETWORK", "Network request failed", {
      cause: error,
    });
  } finally {
    clearTimeout(timeout);
  }
}

