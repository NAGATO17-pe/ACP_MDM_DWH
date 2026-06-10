"use client";

import Link from "next/link";
import { Maximize2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StatusLevel } from "@/lib/schemas/control-center";

/**
 * Frame compartido por todas las cards del dashboard.
 *
 * Aporta tres mejoras visuales del Nivel V2/V3:
 *
 *  - **border-l-4 tonal** según `level` (Grafana-style): el ojo va
 *    directo a las tarjetas en estado warning/critical.
 *  - **Click-through**: opcionalmente envuelve la card en un `<Link>`
 *    al detalle (`/etl-monitor`, `/quality`, etc.) con icono `Maximize2`
 *    que aparece en hover.
 *  - **Estados de hover/focus** consistentes con el resto del portal.
 */
export function DashboardCardFrame({
  title,
  description,
  href,
  level,
  children,
}: {
  title: string;
  description?: string;
  href?: string;
  level?: StatusLevel;
  children: React.ReactNode;
}) {
  const borderTone =
    level === "critical"
      ? "border-l-[var(--color-destructive)]"
      : level === "warning"
        ? "border-l-[var(--color-warning)]"
        : level === "ok"
          ? "border-l-[var(--color-success)]"
          : "border-l-[var(--color-border)]";

  // Hover: ring de 1px + bg shift sutil + shadow. Easing exponencial
  // (ease-out-quart) y duración base. El focus ring vive en el <Link>
  // padre, no en la card — así el teclado ve el foco real.
  // Reduced-motion → la regla global de `globals.css` desactiva todo.
  const interactive = href
    ? cn(
        "group cursor-pointer transition-[box-shadow,background-color,border-color]",
        "duration-[var(--motion-base)] ease-[var(--ease-out-quart)]",
        "group-hover:bg-[color-mix(in_oklab,var(--color-surface-2)_40%,var(--color-surface))]",
        "group-hover:border-[var(--color-border-strong)]",
        "group-hover:shadow-[0_0_0_1px_var(--color-border-strong),0_8px_16px_-4px_rgba(0,0,0,0.4)]",
      )
    : "";

  const card = (
    <Card
      className={cn(
        "h-full border-l-4",
        borderTone,
        interactive,
      )}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>{title}</CardTitle>
            {description ? (
              <CardDescription>{description}</CardDescription>
            ) : null}
          </div>
          {href ? (
            // V8: el icono Maximize2 ahora también escala suave en hover
            // — refuerza el affordance sin reemplazar el ring.
            <Maximize2
              aria-hidden
              className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] opacity-0 transition-[opacity,transform,color] duration-[var(--motion-base)] group-hover:scale-110 group-hover:text-[var(--color-text)] group-hover:opacity-100 group-focus-visible:opacity-100"
            />
          ) : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );

  if (!href) return card;

  return (
    <Link
      href={href}
      aria-label={`Abrir detalle: ${title}`}
      className={cn(
        "group block h-full rounded-lg",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
      )}
    >
      {card}
    </Link>
  );
}
