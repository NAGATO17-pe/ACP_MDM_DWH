/**
 * components/ui/status-badge.tsx
 * ==============================
 * Badge unificado para cualquier estado/severidad/nivel del portal.
 *
 * Reemplaza la suma de `EtlStatusBadge`, `BitacoraStatusBadge`,
 * `SeverityChip`, `SeverityIcon` y `StatusDot`. Esos quedan como
 * re-exports finos sobre éste para no romper imports existentes.
 *
 * Variantes:
 *  - `pill`  : píldora con borde tonal + icono + label  (default)
 *  - `chip`  : compact tinted, redondeado completo
 *  - `dot`   : solo el punto coloreado (con label opcional al lado)
 *  - `icon`  : solo el icono coloreado, label como aria
 *
 * Tamaños: `sm` | `md`. La densidad sigue al token global, no a flags.
 */

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { TONE, type Tone } from "@/lib/status";

type Variant = "pill" | "chip" | "dot" | "icon";
type Size = "sm" | "md";

export interface StatusBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  tone: Tone;
  /** Etiqueta — opcional para variant=dot/icon. Si omitido, usa TONE[tone].label. */
  label?: string;
  /** Icono opcional. Si no se pasa, usa el icono canónico de TONE[tone]. */
  icon?: LucideIcon;
  /** Si el icono debe girar (estado en proceso). */
  spin?: boolean;
  variant?: Variant;
  size?: Size;
  /** Pulso solo cuando tone="critical" (status dot live). */
  pulse?: boolean;
}

const SIZE_TEXT: Record<Size, string> = {
  sm: "text-[11px]",
  md: "text-xs",
};

const SIZE_PAD_PILL: Record<Size, string> = {
  sm: "px-1.5 py-0.5",
  md: "px-2 py-0.5",
};

const SIZE_ICON: Record<Size, string> = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
};

const SIZE_DOT: Record<Size, string> = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
};

export function StatusBadge({
  tone,
  label,
  icon,
  spin,
  variant = "pill",
  size = "md",
  pulse,
  className,
  ...rest
}: StatusBadgeProps) {
  const def = TONE[tone];
  const Icon = (icon ?? def.icon) as LucideIcon;
  const text = label ?? def.label;
  const isCritical = tone === "critical";
  const shouldPulse = pulse && isCritical;

  if (variant === "icon") {
    return (
      <Icon
        role="img"
        aria-label={text}
        className={cn(SIZE_ICON[size], def.text, spin && "animate-spin", className)}
        {...(rest as React.SVGAttributes<SVGSVGElement>)}
      />
    );
  }

  if (variant === "dot") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2",
          SIZE_TEXT[size],
          def.text,
          className,
        )}
        {...rest}
      >
        <span
          aria-hidden
          className={cn(
            "inline-block rounded-full",
            SIZE_DOT[size],
            def.bg,
            shouldPulse && "status-dot-critical",
          )}
        />
        {label !== "" && text ? <span>{text}</span> : null}
      </span>
    );
  }

  if (variant === "chip") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border font-medium",
          SIZE_TEXT[size],
          SIZE_PAD_PILL[size],
          def.tint,
          def.ring,
          def.text,
          className,
        )}
        {...rest}
      >
        <Icon aria-hidden className={cn(SIZE_ICON[size], spin && "animate-spin")} />
        {text ? <span>{text}</span> : null}
      </span>
    );
  }

  // pill (default)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-medium",
        SIZE_TEXT[size],
        SIZE_PAD_PILL[size],
        def.tint,
        def.ring,
        def.text,
        className,
      )}
      {...rest}
    >
      <Icon aria-hidden className={cn(SIZE_ICON[size], spin && "animate-spin")} />
      {text ? <span>{text}</span> : null}
    </span>
  );
}
