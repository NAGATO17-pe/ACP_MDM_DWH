/**
 * lib/auth/roles.ts
 * =================
 * Fuente única de verdad para resolver el rol del frontend a partir del
 * payload del JWT emitido por el backend FastAPI.
 *
 * Contexto del bug histórico que este módulo cierra:
 *
 *  - El backend emite roles: `admin | operador_etl | analista_mdm | viewer`.
 *  - El frontend declara roles: `analyst | admin | executive` (lib/auth/rbac.ts).
 *  - Hasta antes de este módulo, `proxy.ts` y `lib/auth/session.ts`
 *    decodificaban el JWT y, ante CUALQUIER rol no reconocido, hacían
 *    `?? "admin"` (fail-OPEN). Resultado: viewers terminaban con permisos
 *    de administrador y un atacante forjando un rol arbitrario conseguía
 *    lo mismo.
 *
 * Reglas de este módulo:
 *
 *  1. **Fail-closed**: si no se puede resolver un rol del frontend válido,
 *     `parseRole` devuelve `null`. NUNCA devuelve `admin` por defecto.
 *  2. **Mapeo explícito** backend → frontend (`BACKEND_TO_FRONTEND`).
 *     Cada rol del backend tiene una entrada deliberada; lo no mapeado
 *     se rechaza.
 *  3. **Un solo lugar**: tanto `proxy.ts` (edge, decode optimista) como
 *     `lib/auth/session.ts` (server, verificación con jose) consumen
 *     `parseRole`. No reimplementen el default en otra parte.
 *
 * Nota sobre `operador_etl` y `analista_mdm`:
 *
 *  El manifest `lib/routes.ts` hoy gatea muchas rutas operativas como
 *  `admin`-only. Mientras esa segregación no se afine, mapeamos esos dos
 *  roles a `admin` para no romper a usuarios reales. Esto es deuda
 *  intencional; el TODO es dividir esas rutas (ej. `/etl-monitor` con
 *  `roles: [ADMIN, OPERADOR_ETL]`) y entonces estos mapeos bajan a roles
 *  más específicos.
 *
 *  `viewer` SÍ baja inmediatamente a `executive` (read-only), que es el
 *  cambio crítico que mata la escalada silenciosa documentada en el bug.
 */

import type { Role } from "./rbac";

/* -------------------------------------------------------------------------- */
/* Roles del backend                                                          */
/* -------------------------------------------------------------------------- */

export const BACKEND_ROLES = [
  "admin",
  "operador_etl",
  "analista_mdm",
  "viewer",
] as const;

export type BackendRol = (typeof BACKEND_ROLES)[number];

export function isBackendRol(value: unknown): value is BackendRol {
  return (
    typeof value === "string" &&
    (BACKEND_ROLES as readonly string[]).includes(value)
  );
}

/* -------------------------------------------------------------------------- */
/* Mapeo explícito backend → frontend                                         */
/* -------------------------------------------------------------------------- */

/**
 * Cada entrada es una decisión consciente. Cambiarla requiere revisar
 * `lib/routes.ts` y `e2e/role-escalation.spec.ts`.
 */
const BACKEND_TO_FRONTEND: Record<BackendRol, Role> = {
  admin: "admin",
  // TODO: cuando `/etl-monitor` declare un rol propio, bajar a ese rol.
  operador_etl: "admin",
  // Cierra deuda intencional documentada en el archivo — analista_mdm mapea
  // a analyst ahora que /quality, /catalogos, /workflows y /home están en RBAC.
  analista_mdm: "analyst",
  // Solo lectura → home ejecutiva (también read-only). Cierra la escalada.
  viewer: "executive",
};

/* -------------------------------------------------------------------------- */
/* parseRole — único punto de resolución                                      */
/* -------------------------------------------------------------------------- */

/**
 * Resuelve el rol del frontend a partir de los claims del JWT.
 *
 *  - Acepta `role` o `rol` como nombre de claim (compatibilidad).
 *  - Si el claim es un rol válido del frontend, lo devuelve directo.
 *  - Si es un rol válido del backend, devuelve el mapeo explícito.
 *  - En cualquier otro caso (ausente, vacío, tipo erróneo, valor
 *    desconocido) devuelve `null`. El caller decide qué hacer
 *    (redirect a login en `proxy.ts`, return null en `session.ts`).
 */
export function parseRole(claims: Record<string, unknown>): Role | null {
  const raw = claims.role ?? claims.rol;
  if (typeof raw !== "string" || raw.length === 0) return null;

  // Rol del frontend ya canónico.
  if (raw === "admin" || raw === "analyst" || raw === "executive") {
    return raw;
  }

  // Rol del backend conocido → mapeo explícito.
  if (isBackendRol(raw)) {
    return BACKEND_TO_FRONTEND[raw];
  }

  // Desconocido → fail-closed. NO devolver admin.
  return null;
}
