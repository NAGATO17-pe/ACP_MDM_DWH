"use client";

import { useState, useEffect, useCallback } from "react";
import type { WidgetConfigFormData } from "@/components/analyst/widget-config-modal";
import type { PlotlyFigure } from "@/components/analyst/plotly-widget";
import type { WidgetState } from "@/components/analyst/widget-grid";

interface SavedLayout {
  widgets: WidgetConfigFormData[];
  savedAt: string | null;
}

type SavedWidgetConfig = Omit<WidgetState, "figure" | "loading" | "error">;

interface UseAnalystHomeResult {
  widgets: WidgetState[];
  editMode: boolean;
  saving: boolean;
  toggleEditMode: () => void;
  addWidget: (config: WidgetConfigFormData) => Promise<void>;
  updateWidget: (config: WidgetConfigFormData) => Promise<void>;
  removeWidget: (id: string) => void;
  reorderWidgets: (newOrder: WidgetState[]) => void;
  saveLayout: () => Promise<void>;
}

async function fetchFigure(config: WidgetConfigFormData): Promise<PlotlyFigure | null> {
  try {
    const res = await fetch("/api/analyst/widget", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        tipo: config.tipo,
        vista: config.vista,
        eje_x: config.eje_x || undefined,
        eje_y: config.eje_y || undefined,
        grupo_by: config.grupo_by || undefined,
        metrica: config.tipo === "kpi" ? config.eje_y : undefined,
        top_n: config.top_n,
        filtros: {
          fecha_desde: config.fecha_desde || undefined,
          fecha_hasta: config.fecha_hasta || undefined,
        },
        forecast_periodos: config.tipo === "forecast" ? config.forecast_periodos : 0,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function useAnalystHome(): UseAnalystHomeResult {
  const [widgets, setWidgets] = useState<WidgetState[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/analyst/home", { credentials: "include" })
      .then((r) => r.json())
      .then(async (saved: SavedLayout) => {
        if (cancelled || !saved.widgets?.length) return;
        const initial: WidgetState[] = saved.widgets.map((c) => ({
          ...c,
          figure: null,
          loading: true,
          error: null,
        }));
        setWidgets(initial);
        const figures = await Promise.all(saved.widgets.map(fetchFigure));
        if (cancelled) return;
        setWidgets((prev) =>
          prev.map((w, i) => ({
            ...w,
            figure: figures[i],
            loading: false,
            error: figures[i] ? null : "No se pudo cargar",
          })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleEditMode = useCallback(() => setEditMode((p) => !p), []);

  const addWidget = useCallback(async (config: WidgetConfigFormData) => {
    const newWidget: WidgetState = { ...config, figure: null, loading: true, error: null };
    setWidgets((prev) => [...prev, newWidget]);
    const figure = await fetchFigure(config);
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === config.id
          ? { ...w, figure, loading: false, error: figure ? null : "No se pudo cargar" }
          : w,
      ),
    );
  }, []);

  const updateWidget = useCallback(async (config: WidgetConfigFormData) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === config.id ? { ...w, ...config, loading: true, error: null } : w)),
    );
    const figure = await fetchFigure(config);
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === config.id
          ? { ...w, figure, loading: false, error: figure ? null : "No se pudo cargar" }
          : w,
      ),
    );
  }, []);

  const removeWidget = useCallback((id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const reorderWidgets = useCallback((newOrder: WidgetState[]) => {
    setWidgets(newOrder);
  }, []);

  const saveLayout = useCallback(async () => {
    setSaving(true);
    try {
      const payload: SavedLayout = {
        widgets: widgets.map(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ({ figure: _f, loading: _l, error: _e, ...config }: WidgetState): SavedWidgetConfig =>
            config,
        ),
        savedAt: new Date().toISOString(),
      };
      await fetch("/api/analyst/home", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
    } finally {
      setSaving(false);
    }
  }, [widgets]);

  return {
    widgets,
    editMode,
    saving,
    toggleEditMode,
    addWidget,
    updateWidget,
    removeWidget,
    reorderWidgets,
    saveLayout,
  };
}
