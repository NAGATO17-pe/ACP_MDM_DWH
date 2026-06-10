/**
 * lib/routes.ts
 * =============
 * Manifest único de las rutas del portal. Es la fuente de verdad para:
 *
 *  1. RBAC (`lib/auth/rbac.ts` deriva `ROLE_ALLOWED_PREFIXES` desde acá).
 *  2. Sidebar (`buildNavGroups(role)` arma los `<NavGroup>` agrupados).
 *  3. Breadcrumbs y títulos canónicos.
 *  4. Command palette / quick-jump.
 *
 * Añadir una página = un solo bloque acá. Si olvidas el `roles`, TS te
 * grita; si la ruta queda sin grupo, no aparece en la sidebar. Único
 * sitio donde el portal sabe qué existe.
 */

import {
  Bell,
  Compass,
  Database,
  FileText,
  FlaskConical,
  GitPullRequestArrow,
  History,
  Home,
  LayoutDashboard,
  Network,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Telescope,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/lib/auth/rbac";

/* -------------------------------------------------------------------------- */
/* Tipos                                                                       */
/* -------------------------------------------------------------------------- */

export type NavSection = "operaciones" | "analisis" | "gobierno";

export interface RouteDef {
  /** Path absoluto (sin trailing slash). Usado como prefix en RBAC. */
  path: string;
  label: string;
  icon: LucideIcon;
  /** Roles a los que les aparece en la sidebar y pueden visitarla. */
  roles: ReadonlyArray<Role>;
  /** Grupo en la sidebar. Si se omite, no se muestra (pero sigue protegida por RBAC). */
  section?: NavSection;
  /** Si true, no aparece en la sidebar pero sí cuenta para RBAC. */
  hideFromNav?: boolean;
  /** Descripción para command palette / tooltips. */
  description?: string;
}

const ANALYST: Role = "analyst";
const ADMIN: Role = "admin";
const EXECUTIVE: Role = "executive";

/* -------------------------------------------------------------------------- */
/* Manifest                                                                    */
/* -------------------------------------------------------------------------- */

export const ROUTES = {
  dashboard: {
    path: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: [ADMIN],
    section: "operaciones",
    description: "Vista operativa del ecosistema de datos.",
  },
  overview: {
    path: "/overview",
    label: "Visión ejecutiva",
    icon: Telescope,
    roles: [EXECUTIVE, ADMIN],
    section: "gobierno",
    description: "Indicadores agregados para decisión.",
  },
  etlMonitor: {
    path: "/etl-monitor",
    label: "Monitor ETL",
    icon: Workflow,
    roles: [ADMIN, EXECUTIVE],
    section: "operaciones",
    description: "Estado de corridas ETL en curso e histórico.",
  },
  dwh: {
    path: "/dwh",
    label: "DWH Explorer",
    icon: Network,
    roles: [ADMIN],
    section: "operaciones",
    description: "Catálogo de tablas, columnas y lineage.",
  },
  workflows: {
    path: "/workflows",
    label: "Workflows MDM",
    icon: GitPullRequestArrow,
    roles: [ADMIN, ANALYST],
    section: "operaciones",
    description: "Procesos de homologación y reinyección.",
  },
  quality: {
    path: "/quality",
    label: "Calidad de datos",
    icon: ShieldCheck,
    roles: [ADMIN, ANALYST],
    section: "operaciones",
    description: "Cuarentena, KPIs y rechazos.",
  },
  alerts: {
    path: "/alerts",
    label: "Alertas",
    icon: ShieldAlert,
    roles: [ADMIN, EXECUTIVE],
    section: "operaciones",
    description: "Eventos accionables del portal y backend.",
  },
  home: {
    path: "/home",
    label: "Mi Workspace",
    icon: Home,
    roles: [ANALYST],
    section: "analisis",
    description: "Workspace analítico con widgets configurables.",
  },
  notifications: {
    path: "/notifications",
    label: "Notificaciones",
    icon: Bell,
    roles: [ANALYST, ADMIN],
    section: "analisis",
    description: "Alertas ETL y calidad de datos.",
  },
  explore: {
    path: "/explore",
    label: "Exploración DWH",
    icon: Compass,
    roles: [ANALYST, ADMIN],
    section: "analisis",
  },
  models: {
    path: "/models",
    label: "Modelos",
    icon: FlaskConical,
    roles: [ANALYST, ADMIN],
    section: "analisis",
  },
  reports: {
    path: "/reports",
    label: "Reportes",
    icon: FileText,
    roles: [ANALYST, ADMIN],
    section: "gobierno",
  },
  catalogos: {
    path: "/catalogos",
    label: "Catálogos",
    icon: Database,
    roles: [ADMIN, ANALYST],
    section: "gobierno",
  },
  bitacora: {
    path: "/bitacora",
    label: "Bitácora",
    icon: History,
    roles: [ADMIN],
    section: "gobierno",
  },
  configuracion: {
    path: "/configuracion",
    label: "Configuración",
    icon: Settings,
    roles: [ADMIN],
    section: "gobierno",
  },
} as const satisfies Record<string, RouteDef>;

export type RouteKey = keyof typeof ROUTES;

/* -------------------------------------------------------------------------- */
/* Derivaciones                                                                */
/* -------------------------------------------------------------------------- */

/** Lista plana — útil para iterar. */
export const ROUTE_LIST: ReadonlyArray<RouteDef> = Object.values(ROUTES);

/** Path prefixes permitidos por rol. Consumido por rbac.isRoleAllowed. */
export function rolePrefixes(role: Role): string[] {
  return ROUTE_LIST.filter((r) => r.roles.includes(role)).map((r) => r.path);
}

/** Definición pivot — title del grupo + orden. */
const SECTION_LABEL: Record<NavSection, string> = {
  operaciones: "Operaciones",
  analisis: "Análisis",
  gobierno: "Gobierno",
};
const SECTION_ORDER: NavSection[] = ["operaciones", "analisis", "gobierno"];

import * as React from "react";

export interface NavItemDerived {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export interface NavGroupDerived {
  title: string;
  items: NavItemDerived[];
}

const NAV_ICON_CLASS = "h-4 w-4 shrink-0";

/** Construye los grupos de navegación para un rol. Omite secciones vacías. */
export function buildNavGroups(role: Role): NavGroupDerived[] {
  const visible = ROUTE_LIST.filter(
    (r) => r.roles.includes(role) && !r.hideFromNav && r.section != null,
  );

  return SECTION_ORDER.flatMap((section) => {
    const items = visible
      .filter((r) => r.section === section)
      .map<NavItemDerived>((r) => ({
        href: r.path,
        label: r.label,
        icon: React.createElement(r.icon, {
          "aria-hidden": true,
          className: NAV_ICON_CLASS,
        }),
      }));
    if (items.length === 0) return [];
    return [{ title: SECTION_LABEL[section], items }];
  });
}

/** Devuelve la definición de la ruta que matchea el path (prefix). */
export function findRoute(pathname: string): RouteDef | undefined {
  return ROUTE_LIST.find(
    (r) => pathname === r.path || pathname.startsWith(`${r.path}/`),
  );
}

// Re-export para imports lazy desde components/layout/role-shell sin ciclo.
export { Bell };
