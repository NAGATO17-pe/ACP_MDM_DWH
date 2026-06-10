/**
 * lib/control-center/compute-alerts.ts
 * ====================================
 * Cálculo de alertas activas combinando varios endpoints del FastAPI.
 *
 * Extraído del route handler `app/api/cc/alerts/route.ts` para que el
 * stream SSE (`app/api/cc/alerts/stream/route.ts`) reuse la misma
 * lógica sin duplicar — single source of truth.
 *
 * Server-only: usa `fastapiFetchSafe` que reenvía la cookie httpOnly.
 */

import "server-only";

import { z } from "zod";

import { fastapiFetchSafe } from "@/lib/api/server-fetch";
import { isErrored } from "@/lib/control-center/etl-status";
import {
  FastApiAckAlerta,
  FastApiLogCarga,
  FastApiResumenCuarentena,
  type Alert,
} from "@/lib/schemas/control-center";

interface AckIndex {
  acked: Set<string>;
  by: Map<string, string>;
  at: Map<string, string>;
  comment: Map<string, string | null>;
}

async function obtenerIndiceAcks(): Promise<AckIndex> {
  const raw = await fastapiFetchSafe<unknown>("/api/v1/alertas/acks");
  const idx: AckIndex = {
    acked: new Set(),
    by: new Map(),
    at: new Map(),
    comment: new Map(),
  };
  if (!raw) return idx;
  const parsed = z.array(FastApiAckAlerta).safeParse(raw);
  if (!parsed.success) return idx;
  for (const a of parsed.data) {
    idx.acked.add(a.id_alerta);
    idx.by.set(a.id_alerta, a.usuario_dni);
    idx.at.set(a.id_alerta, a.fecha_ack);
    idx.comment.set(a.id_alerta, a.comentario ?? null);
  }
  return idx;
}

function aplicarAck(alert: Alert, idx: AckIndex): Alert {
  if (!idx.acked.has(alert.id)) return alert;
  return {
    ...alert,
    acknowledged: true,
    ackedBy: idx.by.get(alert.id) ?? null,
    ackedAt: idx.at.get(alert.id) ?? null,
    ackComment: idx.comment.get(alert.id) ?? null,
  };
}

export async function computeAlerts(): Promise<Alert[]> {
  const [corridasRaw, cuarentenaRaw, ackIdx] = await Promise.all([
    fastapiFetchSafe<unknown>("/api/v1/etl/corridas?limite=50"),
    fastapiFetchSafe<unknown>("/api/v1/cuarentena/resumen"),
    obtenerIndiceAcks(),
  ]);

  const corridasParsed = corridasRaw
    ? z.array(FastApiLogCarga).safeParse(corridasRaw)
    : null;
  const cuarentenaParsed = cuarentenaRaw
    ? FastApiResumenCuarentena.safeParse(cuarentenaRaw)
    : null;

  const corridas =
    corridasParsed && corridasParsed.success ? corridasParsed.data : [];
  const cuarentena =
    cuarentenaParsed && cuarentenaParsed.success ? cuarentenaParsed.data : null;

  const alerts: Alert[] = [];
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  for (const c of corridas) {
    if (!isErrored(c.estado)) continue;
    const when = c.fecha_inicio ?? c.fecha_fin;
    if (!when) continue;
    if (now - new Date(when).getTime() > day) continue;
    alerts.push(
      aplicarAck(
        {
          id: `etl-${c.id_log}`,
          severity: "critical",
          source: `ETL ${c.nombre_proceso}`,
          message:
            c.mensaje_error ?? `Corrida ${c.estado} sobre ${c.tabla_destino}`,
          createdAt: when,
          acknowledged: false,
        },
        ackIdx,
      ),
    );
  }

  if (cuarentena && cuarentena.pendientes > 0) {
    alerts.push(
      aplicarAck(
        {
          id: "cuarentena-pendientes",
          severity: cuarentena.pendientes > 20 ? "critical" : "warning",
          source: "MDM Cuarentena",
          message: `${cuarentena.pendientes} registro(s) pendiente(s) de resolución`,
          createdAt: new Date().toISOString(),
          acknowledged: false,
        },
        ackIdx,
      ),
    );
  }

  if (!corridasParsed?.success && corridasRaw == null) {
    alerts.unshift(
      aplicarAck(
        {
          id: "infra-etl-unreachable",
          severity: "critical",
          source: "Infraestructura",
          message:
            "El endpoint /api/v1/etl/corridas no respondió. Verifica que el FastAPI esté arriba y que el JWT sea válido.",
          createdAt: new Date().toISOString(),
          acknowledged: false,
        },
        ackIdx,
      ),
    );
  }

  alerts.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return alerts;
}

/**
 * Hash determinístico del set de alertas para comparar entre ticks.
 * Solo cambia si IDs, severity o estado de ack cambian.
 */
export function alertsFingerprint(alerts: Alert[]): string {
  return alerts
    .map((a) => `${a.id}:${a.severity}:${a.acknowledged ? 1 : 0}`)
    .sort()
    .join("|");
}
