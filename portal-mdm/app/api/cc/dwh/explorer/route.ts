import { NextResponse } from "next/server";
import { z } from "zod";
import { fastapiFetchSafe } from "@/lib/api/server-fetch";
import { isErrored, isSuccess } from "@/lib/control-center/etl-status";
import {
  FastApiFact,
  FastApiLogCarga,
} from "@/lib/schemas/control-center";
import type {
  DwhEdge,
  DwhExplorerPayload,
  DwhNode,
  FactSummary,
  TableStatus,
} from "@/lib/schemas/dwh";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Si la última carga es más antigua que esto, marcamos la tabla "stale". */
const STALE_MS = 3 * DAY_MS;

interface LoadStats {
  rowsLast24h: number;
  rejectedLast24h: number;
  lastLoadAt: string | null;
  lastFailedAt: string | null;
  hadSuccessRecent: boolean;
}

const EMPTY_STATS: LoadStats = {
  rowsLast24h: 0,
  rejectedLast24h: 0,
  lastLoadAt: null,
  lastFailedAt: null,
  hadSuccessRecent: false,
};

function statsFor(
  tableName: string,
  corridas: z.infer<typeof FastApiLogCarga>[],
  now: number,
): LoadStats {
  const stats: LoadStats = { ...EMPTY_STATS };
  for (const c of corridas) {
    if (c.tabla_destino !== tableName) continue;
    const when = c.fecha_fin ?? c.fecha_inicio ?? null;
    if (!when) continue;
    const ts = new Date(when).getTime();
    if (!Number.isFinite(ts)) continue;
    const recent = now - ts < DAY_MS;
    if (recent) {
      stats.rowsLast24h += c.filas_insertadas ?? 0;
      stats.rejectedLast24h += c.filas_rechazadas ?? 0;
    }
    if (!stats.lastLoadAt || ts > new Date(stats.lastLoadAt).getTime()) {
      stats.lastLoadAt = when;
    }
    if (isErrored(c.estado)) {
      if (!stats.lastFailedAt || ts > new Date(stats.lastFailedAt).getTime()) {
        stats.lastFailedAt = when;
      }
    }
    if (isSuccess(c.estado) && recent) stats.hadSuccessRecent = true;
  }
  return stats;
}

function deriveStatus(stats: LoadStats, now: number): TableStatus {
  if (!stats.lastLoadAt) return "unknown";
  const ageMs = now - new Date(stats.lastLoadAt).getTime();
  if (stats.lastFailedAt) {
    const failedAge = now - new Date(stats.lastFailedAt).getTime();
    // Falla más reciente que el último éxito → failed.
    if (
      !stats.hadSuccessRecent ||
      new Date(stats.lastFailedAt).getTime() >
        new Date(stats.lastLoadAt).getTime()
    ) {
      return failedAge < DAY_MS ? "failed" : "warning";
    }
  }
  if (ageMs > STALE_MS) return "stale";
  if (stats.rejectedLast24h > 0) return "warning";
  return "ok";
}

function shortName(full: string): string {
  const dot = full.indexOf(".");
  return dot >= 0 ? full.slice(dot + 1) : full;
}

export async function GET() {
  const { error } = await requireApiSession();
  if (error) return error;

  const [factsRaw, corridasRaw] = await Promise.all([
    fastapiFetchSafe<unknown>(`/api/v1/etl/facts`),
    fastapiFetchSafe<unknown>(`/api/v1/etl/corridas?limite=200`),
  ]);

  const factsParsed = factsRaw ? z.array(FastApiFact).safeParse(factsRaw) : null;
  const corridasParsed = corridasRaw
    ? z.array(FastApiLogCarga).safeParse(corridasRaw)
    : null;

  const facts = factsParsed?.success ? factsParsed.data : [];
  const corridas = corridasParsed?.success ? corridasParsed.data : [];
  const now = Date.now();

  // Acumuladores únicos por tabla (en cualquier capa).
  const bronceMap = new Map<string, Set<string>>(); // tabla → facts que la consumen
  const silverMap = new Map<string, Set<string>>(); // tabla → facts (siempre 1 pero por consistencia)
  const goldMap = new Map<string, Set<string>>(); // tabla → facts que la alimentan
  const edges: DwhEdge[] = [];

  for (const f of facts) {
    // Silver — siempre la tabla_destino del fact.
    if (!silverMap.has(f.tabla_destino)) silverMap.set(f.tabla_destino, new Set());
    silverMap.get(f.tabla_destino)!.add(f.nombre_fact);

    // Bronce edges.
    for (const b of f.fuentes_bronce) {
      if (!bronceMap.has(b)) bronceMap.set(b, new Set());
      bronceMap.get(b)!.add(f.nombre_fact);
      edges.push({ from: b, to: f.tabla_destino, kind: "flow" });
    }

    // Gold edges.
    for (const g of f.marts) {
      if (!goldMap.has(g)) goldMap.set(g, new Set());
      goldMap.get(g)!.add(f.nombre_fact);
      edges.push({ from: f.tabla_destino, to: g, kind: "flow" });
    }

    // Dependencies entre facts (silver → silver).
    for (const dep of f.dependencias) {
      const depFact = facts.find((x) => x.nombre_fact === dep);
      if (!depFact) continue;
      edges.push({
        from: depFact.tabla_destino,
        to: f.tabla_destino,
        kind: "dependency",
      });
    }
  }

  // Construir nodes con stats. Para Bronce/Gold sumamos los stats de los
  // facts que la tocan; para Silver = stats del fact.
  function buildNode(
    fullName: string,
    layer: "bronce" | "silver" | "gold",
    factsForTable: Set<string>,
  ): DwhNode {
    let agg: LoadStats = { ...EMPTY_STATS };
    if (layer === "silver") {
      agg = statsFor(fullName, corridas, now);
    } else {
      // Sumar stats de cada fact-tabla que toca esta bronce/gold.
      for (const factName of factsForTable) {
        const f = facts.find((x) => x.nombre_fact === factName);
        if (!f) continue;
        const s = statsFor(f.tabla_destino, corridas, now);
        agg.rowsLast24h += s.rowsLast24h;
        agg.rejectedLast24h += s.rejectedLast24h;
        if (
          !agg.lastLoadAt ||
          (s.lastLoadAt && new Date(s.lastLoadAt) > new Date(agg.lastLoadAt))
        ) {
          agg.lastLoadAt = s.lastLoadAt;
        }
        if (s.lastFailedAt) agg.lastFailedAt = s.lastFailedAt;
        if (s.hadSuccessRecent) agg.hadSuccessRecent = true;
      }
    }
    return {
      id: fullName,
      layer,
      label: shortName(fullName),
      fullName,
      facts: Array.from(factsForTable).sort(),
      rowsLast24h: agg.rowsLast24h,
      rejectedLast24h: agg.rejectedLast24h,
      lastLoadAt: agg.lastLoadAt,
      status: deriveStatus(agg, now),
    };
  }

  const nodes: DwhNode[] = [
    ...Array.from(bronceMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, fs]) => buildNode(name, "bronce", fs)),
    ...Array.from(silverMap.entries())
      .sort(([a], [b]) => {
        const fa = facts.find((x) => x.tabla_destino === a)?.orden ?? 999;
        const fb = facts.find((x) => x.tabla_destino === b)?.orden ?? 999;
        return fa - fb;
      })
      .map(([name, fs]) => buildNode(name, "silver", fs)),
    ...Array.from(goldMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, fs]) => buildNode(name, "gold", fs)),
  ];

  const factSummaries: FactSummary[] = facts
    .map((f) => {
      const s = statsFor(f.tabla_destino, corridas, now);
      return {
        nombre: f.nombre_fact,
        orden: f.orden,
        tablaDestino: f.tabla_destino,
        fuentesBronce: f.fuentes_bronce,
        dependencias: f.dependencias,
        marts: f.marts,
        estrategiaRerun: f.estrategia_rerun,
        rowsLast24h: s.rowsLast24h,
        rejectedLast24h: s.rejectedLast24h,
        lastLoadAt: s.lastLoadAt,
        status: deriveStatus(s, now),
      };
    })
    .sort((a, b) => a.orden - b.orden);

  const payload: DwhExplorerPayload = {
    generatedAt: new Date(now).toISOString(),
    totals: {
      facts: facts.length,
      bronce: bronceMap.size,
      silver: silverMap.size,
      gold: goldMap.size,
    },
    nodes,
    edges,
    facts: factSummaries,
  };

  return NextResponse.json(payload);
}
