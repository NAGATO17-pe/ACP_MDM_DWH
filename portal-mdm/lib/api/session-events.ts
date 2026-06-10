/**
 * lib/api/session-events.ts
 * =========================
 * Bus de eventos cliente-side para señalar que la sesión expiró.
 *
 * Cualquier wrapper de fetch que reciba 401 llama a
 * `dispatchSessionExpired()`. Un único listener — el
 * `SessionExpiredHandler` montado en los layouts protegidos —
 * captura el evento, cancela queries en vuelo, hace POST al
 * endpoint de logout, muestra un toast y redirige a /login.
 *
 * El dedupe es importante: un dashboard puede tener 6 queries
 * vivas; si el JWT venció, las 6 fallan a la vez con 401. Solo
 * queremos disparar la cadena una vez.
 *
 * `resetSessionExpired()` se llama al login exitoso para
 * rehabilitar el flag en la misma pestaña sin reload.
 */

export const SESSION_EXPIRED_EVENT = "acp:session-expired";

let dispatched = false;

export function dispatchSessionExpired(): void {
  if (typeof window === "undefined") return;
  if (dispatched) return;
  dispatched = true;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

export function resetSessionExpired(): void {
  dispatched = false;
}

/**
 * Error sentinela para 401. Quien lo lance ya disparó el evento;
 * los componentes que lo capturen NO deben mostrar su propio toast
 * destructive — el handler global ya muestra el mensaje canónico.
 */
export class UnauthorizedError extends Error {
  readonly isUnauthorized = true as const;
  constructor(path: string) {
    super(`Sesión expirada al consultar ${path}`);
    this.name = "UnauthorizedError";
  }
}

export function isUnauthorizedError(err: unknown): err is UnauthorizedError {
  return (
    err instanceof UnauthorizedError ||
    (typeof err === "object" &&
      err !== null &&
      "isUnauthorized" in err &&
      (err as { isUnauthorized?: boolean }).isUnauthorized === true)
  );
}
