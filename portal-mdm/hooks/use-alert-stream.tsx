"use client";

/**
 * hooks/use-alert-stream.ts
 * =========================
 * Suscripción SSE al stream `/api/cc/alerts/stream` que reemplaza al
 * polling cada 30s del hook `useActiveAlerts`.
 *
 * Comportamiento:
 *   - Abre EventSource al montar; cierra al desmontar (o al cambiar
 *     `enabled`).
 *   - Cada `event: snapshot|update` actualiza el cache TanStack
 *     en `["cc","alerts"]` — el resto de la app sigue leyendo con
 *     `useActiveAlerts` sin saber que ahora es push.
 *   - Reconexión: EventSource del browser reconecta solo. Para
 *     fallos persistentes hacemos backoff exponencial sobre
 *     `onerror` con jitter, cap a 30s.
 *   - SSR safe: no hace nada si `window` no está disponible.
 *
 * Decisiones de UX (audit impeccable-design):
 *   - P0-A: cuando un update trae N>1 nuevas alertas (cualquier
 *     severidad), agrupamos en un solo toast resumen — no llenamos
 *     el stack con N notificaciones simultáneas.
 *   - P0-B: cada toast lleva action button "Ver" que navega a
 *     `/alerts`. Duración 6000 ms (cap de sonner), no 10s.
 *   - P0-C: severity routing — `critical → toast.error`,
 *     `warning → toast.warning`, `info → toast.info`. Iconos
 *     unificados vía SeverityIcon.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { SeverityIcon } from "@/components/control-center/severity-chip";
import { SESSION_EXPIRED_EVENT } from "@/lib/api/session-events";
import type { Alert } from "@/lib/schemas/control-center";

interface UseAlertStreamOptions {
  enabled?: boolean;
  /** URL del stream; útil para tests. */
  url?: string;
  /** Si true, dispara toast cuando llegan alertas nuevas. */
  toastOnNew?: boolean;
}

const QUERY_KEY = ["cc", "alerts"] as const;
const TOAST_DURATION_MS = 6_000;

type ToastFn = typeof toast.error;

const TOAST_BY_SEVERITY: Record<Alert["severity"], ToastFn> = {
  critical: toast.error,
  warning: toast.warning,
  info: toast.info,
};

// Module-level SSE status — shared across all renders.
// Broadcasting via a custom DOM event avoids a React context provider chain.
type SseStatus = "connecting" | "connected" | "reconnecting";
let _sseStatus: SseStatus = "connecting";

function setSseStatus(s: SseStatus) {
  _sseStatus = s;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("__sse_status"));
  }
}

export function getSseStatus(): SseStatus {
  return _sseStatus;
}

export function useSSEStatus(): SseStatus {
  const [status, setStatus] = useState<SseStatus>(() => _sseStatus);
  useEffect(() => {
    const handler = () => setStatus(_sseStatus);
    window.addEventListener("__sse_status", handler);
    return () => window.removeEventListener("__sse_status", handler);
  }, []);
  return status;
}

function pickHighestSeverity(alerts: Alert[]): Alert["severity"] {
  if (alerts.some((a) => a.severity === "critical")) return "critical";
  if (alerts.some((a) => a.severity === "warning")) return "warning";
  return "info";
}

export function useAlertStream({
  enabled = true,
  url = "/api/cc/alerts/stream",
  toastOnNew = true,
}: UseAlertStreamOptions = {}): void {
  const queryClient = useQueryClient();
  const router = useRouter();
  const knownIdsRef = useRef<Set<string>>(new Set());
  const backoffRef = useRef<number>(1_000);
  const closedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    let source: EventSource | null = null;
    let reconnectTimer: number | null = null;
    closedRef.current = false;

    const notify = (newAlerts: Alert[]) => {
      if (newAlerts.length === 0) return;

      const goToAlerts = {
        label: "Ver",
        onClick: () => router.push("/alerts"),
      };

      if (newAlerts.length === 1) {
        const alert = newAlerts[0];
        const showToast = TOAST_BY_SEVERITY[alert.severity];
        showToast(alert.message, {
          description: alert.source,
          icon: <SeverityIcon severity={alert.severity} />,
          duration: TOAST_DURATION_MS,
          action: goToAlerts,
        });
        return;
      }

      // Batch: una sola notificación resumen con la severidad más alta.
      const highest = pickHighestSeverity(newAlerts);
      const showToast = TOAST_BY_SEVERITY[highest];
      const criticals = newAlerts.filter(
        (a) => a.severity === "critical",
      ).length;
      const warnings = newAlerts.filter(
        (a) => a.severity === "warning",
      ).length;
      const parts: string[] = [];
      if (criticals > 0) parts.push(`${criticals} crítica(s)`);
      if (warnings > 0) parts.push(`${warnings} advertencia(s)`);

      showToast(`${newAlerts.length} alertas nuevas`, {
        description: parts.join(" · ") || "Revisar pendientes",
        icon: <SeverityIcon severity={highest} />,
        duration: TOAST_DURATION_MS,
        action: goToAlerts,
      });
    };

    const applyAlerts = (alerts: Alert[]) => {
      queryClient.setQueryData(QUERY_KEY, alerts);

      if (!toastOnNew) {
        knownIdsRef.current = new Set(alerts.map((a) => a.id));
        return;
      }

      const prev = knownIdsRef.current;
      const next = new Set(alerts.map((a) => a.id));
      const newAlerts: Alert[] = [];
      for (const alert of alerts) {
        if (!prev.has(alert.id) && !alert.acknowledged) {
          newAlerts.push(alert);
        }
      }
      notify(newAlerts);
      knownIdsRef.current = next;  // sincronizado en cada ciclo — evita crecimiento indefinido
    };

    const connect = () => {
      if (closedRef.current) return;
      source = new EventSource(url, { withCredentials: true });

      source.addEventListener("snapshot", (e) => {
        try {
          const parsed = JSON.parse(e.data) as Alert[];
          // Primer snapshot: NO disparamos toast; sólo seedeamos.
          knownIdsRef.current = new Set(parsed.map((a) => a.id));
          queryClient.setQueryData(QUERY_KEY, parsed);
          backoffRef.current = 1_000; // reset
          setSseStatus("connected");
        } catch {
          // payload inválido — el próximo update corrige
        }
      });

      source.addEventListener("update", (e) => {
        try {
          const parsed = JSON.parse(e.data) as Alert[];
          applyAlerts(parsed);
          backoffRef.current = 1_000;
        } catch {
          // ignore
        }
      });

      source.onerror = () => {
        // EventSource intenta reconectar solo. Sólo cerramos y
        // backoffeamos si el fallo es persistente.
        if (closedRef.current) return;
        source?.close();
        source = null;
        setSseStatus("reconnecting");
        const delay =
          Math.min(backoffRef.current, 30_000) + Math.random() * 500;
        reconnectTimer = window.setTimeout(connect, delay);
        backoffRef.current = Math.min(backoffRef.current * 2, 30_000);
      };
    };

    // Si la sesión expira en otra query, cierra el stream para que
    // no quede reintentando contra 401 en background.
    const onSessionExpired = () => {
      closedRef.current = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      source?.close();
      source = null;
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);

    setSseStatus("connecting");
    connect();

    return () => {
      closedRef.current = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      source?.close();
      source = null;
      window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    };
  }, [enabled, url, queryClient, router, toastOnNew]);
}
