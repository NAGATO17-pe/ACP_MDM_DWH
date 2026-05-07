/**
 * Thin fetch wrapper for the FastAPI backend.
 * - Server-side: forwards the JWT cookie automatically.
 * - Client-side: relies on the httpOnly cookie set at /api/auth/login.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: Json;
  /** Forwarded JWT (server-side calls). Client calls leave undefined. */
  token?: string;
}

interface BlobOptions extends Omit<ApiOptions, "body"> {
  /** Expected content-type (sent as Accept header). Defaults to */* */
  accept?: string;
}

/**
 * Build common headers for both JSON and blob requests.
 */
function buildHeaders(options: {
  token?: string;
  accept: string;
  contentType?: string;
  extra?: HeadersInit;
}): HeadersInit {
  return {
    accept: options.accept,
    ...(options.contentType ? { "content-type": options.contentType } : {}),
    ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    ...options.extra,
  };
}

/**
 * Handle 401 by triggering a client-side redirect to /login.
 * Server-side throws ApiError as usual (caller should let it bubble to error.tsx).
 */
function handle401() {
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, token, headers, ...rest } = options;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: buildHeaders({
      token,
      accept: "application/json",
      contentType: "application/json",
      extra: headers,
    }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: rest.cache ?? "no-store",
    credentials: rest.credentials ?? "include",
  });

  const text = await res.text();
  const parsed: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    if (res.status === 401) handle401();
    const message =
      (parsed && typeof parsed === "object" && "detail" in parsed
        ? String((parsed as { detail: unknown }).detail)
        : res.statusText) || "Request failed";
    throw new ApiError(res.status, message, parsed);
  }

  return parsed as T;
}

/**
 * Fetch a binary resource (CSV/PDF/XLSX) and return it as a Blob.
 * Reuses the same auth & error handling as `apiFetch`.
 */
export async function apiFetchBlob(path: string, options: BlobOptions = {}): Promise<Blob> {
  const { token, headers, accept = "*/*", ...rest } = options;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: buildHeaders({ token, accept, extra: headers }),
    cache: rest.cache ?? "no-store",
    credentials: rest.credentials ?? "include",
  });

  if (!res.ok) {
    if (res.status === 401) handle401();
    throw new ApiError(res.status, res.statusText || "Download failed", null);
  }

  return res.blob();
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Extract a user-facing message from an unknown error.
 * - ApiError: returns its message (typically the FastAPI `detail` field)
 * - Other Error: returns its message
 * - Anything else: returns the provided fallback
 */
export function getErrorMessage(err: unknown, fallback = "Intenta nuevamente."): string {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}
