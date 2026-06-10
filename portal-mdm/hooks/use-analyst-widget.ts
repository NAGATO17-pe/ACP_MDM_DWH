"use client";

import { useState } from "react";
import type { PlotlyFigure } from "@/components/analyst/plotly-widget";

export interface WidgetConfig {
  tipo: string;
  vista: string;
  eje_x?: string;
  eje_y?: string;
  grupo_by?: string;
  metrica?: string;
  columnas?: string[];
  top_n?: number;
  filtros?: {
    fecha_desde?: string;
    fecha_hasta?: string;
    dimension_valor?: string;
  };
  forecast_periodos?: number;
}

interface UseAnalystWidgetResult {
  figure: PlotlyFigure | null;
  loading: boolean;
  error: string | null;
  fetchWidget: (config: WidgetConfig) => Promise<void>;
}

export function useAnalystWidget(): UseAnalystWidgetResult {
  const [figure, setFigure] = useState<PlotlyFigure | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchWidget(config: WidgetConfig) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyst/widget", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(config),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { detail?: string }).detail ?? `Error ${res.status}`);
      }
      const fig = (await res.json()) as PlotlyFigure;
      setFigure(fig);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  return { figure, loading, error, fetchWidget };
}
