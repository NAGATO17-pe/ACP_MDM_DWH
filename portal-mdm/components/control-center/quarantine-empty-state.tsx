import { ShieldCheck } from "lucide-react";

interface QuarantineEmptyStateProps {
  /** Si hay filtro activo, mensaje cambia para sugerir limpiar. */
  filtered?: boolean;
}

export function QuarantineEmptyState({ filtered = false }: QuarantineEmptyStateProps) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-4 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center"
    >
      <span
        aria-hidden
        className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-success)_12%,transparent)] text-[var(--color-success)]"
      >
        <ShieldCheck className="h-8 w-8" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-[var(--color-text)]">
          {filtered
            ? "Sin coincidencias con el filtro"
            : "Sin registros en cuarentena"}
        </p>
        <p className="max-w-md text-sm text-[var(--color-text-muted)]">
          {filtered
            ? "Ajusta la tabla buscada o limpia el filtro para ver todos los registros pendientes."
            : "Todos los datos pasaron las reglas de validación. No hay registros pendientes de revisión MDM."}
        </p>
      </div>
    </div>
  );
}
