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

export function isLikelyNetworkError(error: unknown) {
  if (error instanceof ClientRequestError) {
    return error.code === "TIMEOUT" || error.code === "NETWORK";
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /network request failed|failed to fetch|networkerror|timed out/i.test(message);
}

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

