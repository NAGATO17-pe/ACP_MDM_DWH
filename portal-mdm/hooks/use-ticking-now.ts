"use client";

import { useEffect, useState } from "react";

/**
 * Hook que devuelve `Date.now()` actualizándose cada `intervalMs`.
 * Útil para "hace Xs", elapsed timers de procesos en vivo, freshness chips.
 *
 * Usar UN solo `useTickingNow` por componente — varios componentes que lo
 * usen tickearán en paralelo (un setInterval por instancia, intencional
 * para que cada uno pueda elegir su cadencia).
 *
 * @example
 *   const now = useTickingNow(1000);
 *   const elapsed = Math.floor((now - startedAt) / 1000);
 */
export function useTickingNow(intervalMs = 1000): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Formatea segundos como "1m 23s" o "23s" o "1h 5m". */
export function formatElapsed(sec: number): string {
  if (sec < 0) return "0s";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  }
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

/** "hace 12s", "hace 3m", "hace 2h". null → "—". */
export function formatRelativeAgo(iso: string | null, now: number): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const diff = Math.max(0, Math.floor((now - t) / 1000));
  if (diff < 5) return "ahora";
  if (diff < 60) return `hace ${diff}s`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  return `hace ${Math.floor(diff / 3600)}h`;
}
