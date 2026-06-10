"use client";

/**
 * Mount client-side de la suscripción SSE de alertas.
 *
 * Renderiza `null`. Solo existe para conectar `useAlertStream()` a
 * cualquier subárbol del admin (montado desde `app/(admin)/layout.tsx`).
 * Mantenerlo separado evita marcar el layout entero como cliente.
 */

import { useAlertStream } from "@/hooks/use-alert-stream";

export function AlertStreamMount() {
  useAlertStream();
  return null;
}
