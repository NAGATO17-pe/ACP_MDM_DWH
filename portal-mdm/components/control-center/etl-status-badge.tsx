import { StatusBadge } from "@/components/ui/status-badge";
import { toneFromCorrida } from "@/lib/status";
import type { CorridaStatus } from "@/lib/control-center/etl-status";

/**
 * Wrapper fino sobre <StatusBadge>. Mantiene la API histórica
 * `<EtlStatusBadge status={...} />`; la lógica vive en `lib/status.ts`.
 */
export function EtlStatusBadge({ status }: { status: CorridaStatus }) {
  const cfg = toneFromCorrida(status);
  return (
    <StatusBadge
      tone={cfg.tone}
      label={cfg.label}
      icon={cfg.icon}
      spin={cfg.spin}
      variant="pill"
    />
  );
}
