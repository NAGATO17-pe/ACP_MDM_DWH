"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hook que dispara un flash visual (clase CSS temporal) cuando el valor
 * monitoreado cambia entre renders. Pensado para indicar que un KPI o
 * dato refrescó tras un refetch sin desviar la atención del usuario.
 *
 * @example
 *   const ref = useRef<HTMLSpanElement>(null);
 *   const flashing = useFlashOnChange(value);
 *   <span ref={ref} className={cn("tabular-nums", flashing && "kpi-flash")}>
 *     {value}
 *   </span>
 *
 * El CSS de `.kpi-flash` vive en `app/globals.css`.
 * Reduced-motion lo desactiva globalmente.
 */
export function useFlashOnChange<T>(value: T, durationMs = 600): boolean {
  const previous = useRef<T>(value);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (previous.current !== value) {
      previous.current = value;
      setFlashing(true);
      const t = setTimeout(() => setFlashing(false), durationMs);
      return () => clearTimeout(t);
    }
  }, [value, durationMs]);

  return flashing;
}
