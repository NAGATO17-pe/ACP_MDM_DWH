import { z } from "zod";

/**
 * Contratos del módulo DWH Explorer.
 *
 * El portal compone el grafo de lineage Bronce → Silver → Gold a partir
 * del catálogo de facts (`/api/v1/etl/facts`) + estadísticas recientes
 * (`/api/v1/etl/corridas`). El route handler agrega todo y deja al
 * cliente con un payload ya plano.
 */

export const TableLayer = z.enum(["bronce", "silver", "gold"]);
export type TableLayer = z.infer<typeof TableLayer>;

export const TableStatus = z.enum(["ok", "warning", "failed", "stale", "unknown"]);
export type TableStatus = z.infer<typeof TableStatus>;

/** Nodo del grafo — una tabla del DWH en cualquier capa. */
export const DwhNode = z.object({
  id: z.string(), // ej: "Bronce.Cosecha_Raw"
  layer: TableLayer,
  /** Nombre de tabla sin schema, para mostrar (ej: "Cosecha_Raw"). */
  label: z.string(),
  /** Nombre completo con schema (ej: "Bronce.Cosecha_Raw"). */
  fullName: z.string(),
  /** Facts asociados (si la tabla es Silver, suele ser uno). */
  facts: z.array(z.string()),
  /** Filas insertadas en últimas 24h (sumadas si hay varias corridas). */
  rowsLast24h: z.number().int().nonnegative(),
  /** Filas rechazadas en últimas 24h. */
  rejectedLast24h: z.number().int().nonnegative(),
  lastLoadAt: z.string().nullable(),
  status: TableStatus,
});
export type DwhNode = z.infer<typeof DwhNode>;

/** Arista del grafo: data flow o dependencia entre facts. */
export const DwhEdge = z.object({
  from: z.string(),
  to: z.string(),
  kind: z.enum(["flow", "dependency"]),
});
export type DwhEdge = z.infer<typeof DwhEdge>;

/** Resumen de un fact para drawer / tabla. */
export const FactSummary = z.object({
  nombre: z.string(),
  orden: z.number().int(),
  tablaDestino: z.string(),
  fuentesBronce: z.array(z.string()),
  dependencias: z.array(z.string()),
  marts: z.array(z.string()),
  estrategiaRerun: z.string(),
  rowsLast24h: z.number().int().nonnegative(),
  rejectedLast24h: z.number().int().nonnegative(),
  lastLoadAt: z.string().nullable(),
  status: TableStatus,
});
export type FactSummary = z.infer<typeof FactSummary>;

export const DwhExplorerPayload = z.object({
  generatedAt: z.string(),
  totals: z.object({
    facts: z.number().int().nonnegative(),
    bronce: z.number().int().nonnegative(),
    silver: z.number().int().nonnegative(),
    gold: z.number().int().nonnegative(),
  }),
  nodes: z.array(DwhNode),
  edges: z.array(DwhEdge),
  facts: z.array(FactSummary),
});
export type DwhExplorerPayload = z.infer<typeof DwhExplorerPayload>;
