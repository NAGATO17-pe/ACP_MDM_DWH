"use client";

import { Database } from "lucide-react";

/**
 * Tabla de frescura de datos por fact.
 *
 * TODO: Conectar a GET /api/cc/dwh/facts cuando el endpoint esté disponible.
 * El endpoint deberá retornar: { name: string; lastSuccessAt: string | null }[]
 *
 * Por ahora muestra un placeholder para que no haya datos falsos en el dashboard.
 */
export function DataFreshnessTable() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
      <Database
        aria-hidden
        className="h-7 w-7 text-[var(--color-text-muted)] opacity-40"
      />
      <p className="text-[12px] text-[var(--color-text-muted)]">
        Frescura por fact no disponible
      </p>
      <p className="text-[11px] opacity-50 text-[var(--color-text-muted)]">
        Pendiente: <code className="font-mono">GET /api/cc/dwh/facts</code>
      </p>
    </div>
  );
}
