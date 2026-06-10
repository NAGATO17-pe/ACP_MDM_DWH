/**
 * components/control-center/severity-chip.tsx
 * ============================================
 * Wrappers finos sobre `<StatusBadge>`. La lógica de tono/icono vive
 * en `lib/status.ts`. Las APIs `<SeverityChip>` y `<SeverityIcon>` se
 * mantienen por compat con imports existentes.
 */

import { StatusBadge } from "@/components/ui/status-badge";
import { TONE, toneFromSeverity } from "@/lib/status";
import type { Alert } from "@/lib/schemas/control-center";

export type Severity = Alert["severity"];

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: TONE.critical.label,
  warning: TONE.warning.label,
  info: TONE.info.label,
};

interface SeverityIconProps {
  severity: Severity;
  className?: string;
}

export function SeverityIcon({ severity, className }: SeverityIconProps) {
  return (
    <StatusBadge
      tone={toneFromSeverity(severity)}
      variant="icon"
      className={className}
    />
  );
}

interface SeverityChipProps {
  severity: Severity;
  showLabel?: boolean;
  className?: string;
}

export function SeverityChip({
  severity,
  showLabel = true,
  className,
}: SeverityChipProps) {
  return (
    <StatusBadge
      tone={toneFromSeverity(severity)}
      variant="chip"
      size="sm"
      label={showLabel ? undefined : ""}
      className={className}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Compat — helpers legacy usados por alerts-client.tsx y otros               */
/* -------------------------------------------------------------------------- */

export const severityIcon: Record<Severity, typeof TONE.critical.icon> = {
  critical: TONE.critical.icon,
  warning: TONE.warning.icon,
  info: TONE.info.icon,
};

export const severityTextColor: Record<Severity, string> = {
  critical: TONE.critical.text,
  warning: TONE.warning.text,
  info: TONE.info.text,
};

export const severityTint: Record<Severity, string> = {
  critical: TONE.critical.tint,
  warning: TONE.warning.tint,
  info: TONE.info.tint,
};
