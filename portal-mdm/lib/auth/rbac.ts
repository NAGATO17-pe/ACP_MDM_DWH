export type Role = "analyst" | "admin" | "executive";

export const ROLES: Role[] = ["analyst", "admin", "executive"];

/**
 * ÚNICA FUENTE DE VERDAD para RBAC.
 *
 * Para agregar una ruta nueva:
 *   1. Agrégala aquí con sus roles.
 *   2. Agrégala a lib/routes.ts con label/icon para el sidebar.
 *   ✅ No toques ROLE_ALLOWED_PREFIXES — se deriva automáticamente.
 */
export const ROUTE_ACL: ReadonlyArray<{ path: string; roles: ReadonlyArray<Role> }> = [
  { path: "/dashboard",     roles: ["admin"] },
  { path: "/overview",      roles: ["admin", "executive"] },
  { path: "/etl-monitor",   roles: ["admin", "executive"] },
  { path: "/dwh",           roles: ["admin"] },
  { path: "/workflows",     roles: ["admin", "analyst"] },
  { path: "/quality",       roles: ["admin", "analyst"] },
  { path: "/alerts",        roles: ["admin", "executive"] },
  { path: "/home",          roles: ["analyst"] },
  { path: "/notifications", roles: ["analyst", "admin"] },
  { path: "/explore",       roles: ["analyst", "admin"] },
  { path: "/models",        roles: ["analyst", "admin"] },
  { path: "/reports",       roles: ["analyst", "admin"] },
  { path: "/catalogos",     roles: ["admin", "analyst"] },
  { path: "/bitacora",      roles: ["admin"] },
  { path: "/configuracion", roles: ["admin"] },
  { path: "/audit",         roles: ["admin"] },
];

/** Derivado de ROUTE_ACL — no editar directamente. */
export const ROLE_ALLOWED_PREFIXES: Record<Role, string[]> = {
  analyst:   ROUTE_ACL.filter((r) => r.roles.includes("analyst")).map((r) => r.path),
  admin:     ROUTE_ACL.filter((r) => r.roles.includes("admin")).map((r) => r.path),
  executive: ROUTE_ACL.filter((r) => r.roles.includes("executive")).map((r) => r.path),
};

export const ROLE_HOME: Record<Role, string> = {
  analyst:   "/home",
  admin:     "/dashboard",
  executive: "/overview",
};

/** Rutas disponibles para cualquier usuario autenticado (sin importar rol). */
export const SHARED_AUTHENTICATED_PREFIXES = ["/api/auth/logout", "/api/cc"];

/** Rutas públicas (sin auth). */
export const PUBLIC_PREFIXES = ["/login", "/api/auth/login"];

export function isRoleAllowed(role: Role, pathname: string): boolean {
  if (SHARED_AUTHENTICATED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return true;
  }
  return ROLE_ALLOWED_PREFIXES[role].some((p) => pathname.startsWith(p));
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}
