import { Agent as UndiciAgent } from "undici";
import { cookies } from "next/headers";
import { JWT_COOKIE_NAME } from "@/lib/auth/session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Dispatcher con keep-alive y pipelining para el fetch nativo de Next.js
 * (undici). Sin esto, cada request al FastAPI negocia TCP/TLS desde cero
 * (50–200 ms perdidos por llamada). El dashboard dispara 3–4 fetches en
 * cada navegación; el ahorro es perceptible.
 *
 * Un único pool por proceso de Next.js, reutilizado entre route handlers.
 */
const fastapiDispatcher = new UndiciAgent({
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 60_000,
  connections: 32,
  pipelining: 1,
});

export class FastApiError extends Error {
  status: number;
  body: unknown;
  path: string;
  constructor(status: number, message: string, body: unknown, path: string) {
    super(message);
    this.status = status;
    this.body = body;
    this.path = path;
  }
}

/**
 * Server-side fetch hacia el FastAPI real.
 *
 * - Reenvía el JWT desde la cookie httpOnly del portal como `Authorization: Bearer`.
 * - Aborta tras `timeoutMs` (default 8 s) — sin esto un endpoint colgado deja
 *   al route handler esperando indefinidamente y el dashboard se ve "cargando".
 * - Loguea cualquier fallo en consola server-side para diagnosticar en dev.
 */
export async function fastapiFetch<T = unknown>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init ?? {};
  const store = await cookies();
  const token = store.get(JWT_COOKIE_NAME)?.value;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        accept: "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...rest.headers,
      },
      cache: "no-store",
      signal: controller.signal,
      // `dispatcher` no está tipado en RequestInit pero undici lo respeta.
      ...({ dispatcher: fastapiDispatcher } as RequestInit),
    });

    const text = await res.text();
    const parsed: unknown = text ? safeJson(text) : null;

    if (!res.ok) {
      const message = formatFastApiError(parsed) || res.statusText || "Request failed";
      // Cuando el formatter no encuentra detail/error, imprimir el body crudo
      // para poder diagnosticar (ej. 422 con body vacío del FastAPI).
      const rawSnippet =
        formatFastApiError(parsed) === ""
          ? ` | rawBody=${text ? text.slice(0, 500) : "<empty>"}`
          : "";
      console.error(
        `[fastapiFetch] ${res.status} ${path}: ${message}${rawSnippet}` +
          (token ? "" : " (no JWT cookie present)"),
      );
      throw new FastApiError(res.status, message, parsed, path);
    }

    return parsed as T;
  } catch (err) {
    if (err instanceof FastApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[fastapiFetch] TIMEOUT ${path} after ${timeoutMs}ms`);
      throw new FastApiError(
        504,
        `Timeout (${timeoutMs}ms) llamando ${path}`,
        null,
        path,
      );
    }
    console.error(`[fastapiFetch] FETCH FAIL ${path}:`, err);
    throw new FastApiError(
      502,
      err instanceof Error ? err.message : String(err),
      null,
      path,
    );
  } finally {
    clearTimeout(timer);
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Convierte el cuerpo de error de FastAPI a un string legible.
 *
 * FastAPI usa dos formatos:
 *   - HTTPException → `{ detail: "string" }`
 *   - ValidationError (422) → `{ detail: [{ loc, msg, type, input? }, ...] }`
 *
 * Sin este parseo el portal mostraba "[object Object]" porque
 * `String([{...}])` colapsa a esa cadena inútil.
 */
function formatFastApiError(parsed: unknown): string {
  if (!parsed || typeof parsed !== "object") return "";

  // El backend ACP envuelve errores en StandardResponse: { success:false, error: "...", ... }
  const error = (parsed as { error?: unknown }).error;
  if (typeof error === "string" && error.length > 0) return error;

  const detail = (parsed as { detail?: unknown }).detail;
  if (detail == null) return "";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (!item || typeof item !== "object") return String(item);
        const it = item as { loc?: unknown; msg?: unknown; type?: unknown };
        const loc = Array.isArray(it.loc)
          ? it.loc.filter((p) => p !== "body").join(".")
          : "";
        const msg = typeof it.msg === "string" ? it.msg : "";
        return loc ? `${loc}: ${msg}` : msg;
      })
      .filter(Boolean)
      .join(" | ");
  }
  if (typeof detail === "object") {
    try {
      return JSON.stringify(detail);
    } catch {
      return "";
    }
  }
  return String(detail);
}

/**
 * Wrapper para llamadas opcionales: nunca lanza, retorna null en error.
 * Útil con `Promise.allSettled` cuando queremos respuesta degradada.
 */
export async function fastapiFetchSafe<T = unknown>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T | null> {
  try {
    return await fastapiFetch<T>(path, init);
  } catch {
    return null;
  }
}
