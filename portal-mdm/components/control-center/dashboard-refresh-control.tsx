"use client";

import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

/**
 * Pausa / reanuda el polling automático de todas las queries ["cc"].
 *
 * Cuando el operador necesita analizar un estado estático sin que los datos
 * cambien bajo sus pies, puede pausar el auto-refresh. Al desmontar el
 * componente (navegación), siempre se restaura el estado de polling.
 */
export function DashboardRefreshControl() {
  const queryClient = useQueryClient();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    // Sincroniza el estado de polling con TanStack Query.
    // refetchInterval: false detiene el polling; true vuelve al default
    // que cada query define en sus propias opciones (no lo sobreescribimos).
    queryClient.setQueryDefaults(["cc"], {
      refetchInterval: paused ? false : undefined,
    });
  }, [paused, queryClient]);

  // Restaurar al desmontar (navegar fuera del dashboard).
  useEffect(() => {
    return () => {
      queryClient.setQueryDefaults(["cc"], { refetchInterval: undefined });
    };
  }, [queryClient]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setPaused((p) => !p)}
      aria-label={paused ? "Reanudar auto-refresh" : "Pausar auto-refresh"}
      aria-pressed={paused}
      className="gap-1.5"
    >
      {paused ? (
        <Play aria-hidden className="h-4 w-4 text-[var(--color-success)]" />
      ) : (
        <Pause aria-hidden className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">
        {paused ? "Reanudar" : "Pausar"}
      </span>
    </Button>
  );
}
