import { StatusBadge } from "@/components/ui/status-badge";
import { toneFromBitacora } from "@/lib/status";

/**
 * Wrapper fino sobre <StatusBadge>. Mantiene la API histórica
 * `<BitacoraStatusBadge estado={...} />`.
 */
export function BitacoraStatusBadge({ estado }: { estado: string }) {
  const cfg = toneFromBitacora(estado);
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
