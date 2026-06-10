/**
 * GET /api/cc/alerts/stream
 * =========================
 * Server-Sent Events endpoint que emite el set de alertas activas.
 *
 * Funcionamiento:
 *  - Poll interno cada POLL_MS ms al FastAPI (vía `computeAlerts`).
 *  - Hash determinístico del set; sólo se emite "data:" si cambia.
 *  - Comentario heartbeat cada HEARTBEAT_MS para evitar que el cliente
 *    o algún proxy intermedio cierre la conexión por idle.
 *  - Cierre limpio cuando el cliente aborta (mediante AbortSignal).
 *
 * Esto reemplaza el polling cliente cada 30s (en el hook `useActiveAlerts`)
 * por push real: una nueva alerta crítica aparece en ~POLL_MS (3-5s)
 * en lugar de esperar el próximo refetchInterval.
 *
 * Auth: heredada de la cookie httpOnly. `computeAlerts` usa
 * `fastapiFetchSafe` que reenvía el JWT.
 *
 * Nota: el route handler es `force-dynamic` y `runtime = "nodejs"` —
 * Edge runtime no es compatible con SSE de larga duración.
 */

import {
  alertsFingerprint,
  computeAlerts,
} from "@/lib/control-center/compute-alerts";
import { requireApiSession } from "@/lib/auth/require-api-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_MS = 4_000;
const HEARTBEAT_MS = 15_000;

export async function GET(request: Request) {
  const { error } = await requireApiSession();
  if (error) return error;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let lastFingerprint = "";

      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      // Primer evento inmediato — el cliente no espera POLL_MS.
      try {
        const initial = await computeAlerts();
        lastFingerprint = alertsFingerprint(initial);
        safeEnqueue(`event: snapshot\ndata: ${JSON.stringify(initial)}\n\n`);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "unknown computeAlerts error";
        safeEnqueue(`event: error\ndata: ${JSON.stringify({ msg })}\n\n`);
      }

      const pollTimer = setInterval(async () => {
        if (closed) return;
        try {
          const alerts = await computeAlerts();
          const fp = alertsFingerprint(alerts);
          if (fp !== lastFingerprint) {
            lastFingerprint = fp;
            safeEnqueue(
              `event: update\ndata: ${JSON.stringify(alerts)}\n\n`,
            );
          }
        } catch {
          // Silencioso — la próxima vuelta puede reconectar.
        }
      }, POLL_MS);

      const heartbeatTimer = setInterval(() => {
        if (closed) return;
        // Comentario SSE (`: `) — el browser lo ignora, mantiene viva la conexión.
        safeEnqueue(`: heartbeat ${Date.now()}\n\n`);  // \n\n = fin de evento SSE (RFC 8895)
      }, HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        try {
          controller.close();
        } catch {
          // Ya cerrado.
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Desactiva el buffering en proxies (nginx).
      "x-accel-buffering": "no",
    },
  });
}
