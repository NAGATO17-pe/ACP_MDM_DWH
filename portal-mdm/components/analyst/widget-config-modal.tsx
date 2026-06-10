"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const WIDGET_TYPES = [
  { value: "linea",    label: "Línea de tiempo" },
  { value: "barra",    label: "Barras" },
  { value: "area",     label: "Área" },
  { value: "scatter",  label: "Dispersión" },
  { value: "pie",      label: "Torta / Donut" },
  { value: "kpi",      label: "KPI Card" },
  { value: "tabla",    label: "Tabla de datos" },
  { value: "forecast", label: "Proyección / Forecast" },
] as const;

export type WidgetTipo = (typeof WIDGET_TYPES)[number]["value"];

export interface WidgetConfigFormData {
  id: string;
  titulo: string;
  tipo: WidgetTipo;
  vista: string;
  eje_x: string;
  eje_y: string;
  grupo_by: string;
  fecha_desde: string;
  fecha_hasta: string;
  forecast_periodos: number;
  top_n: number;
  size: "sm" | "md" | "lg";
}

interface VistaInfo {
  nombre: string;
  label: string;
  columnas: string[];
}

interface WidgetConfigModalProps {
  open: boolean;
  initial?: Partial<WidgetConfigFormData>;
  onClose: () => void;
  onSave: (config: WidgetConfigFormData) => void;
}

const DEFAULT_FORM: WidgetConfigFormData = {
  id: "",
  titulo: "",
  tipo: "linea",
  vista: "",
  eje_x: "",
  eje_y: "",
  grupo_by: "",
  fecha_desde: "",
  fecha_hasta: "",
  forecast_periodos: 3,
  top_n: 50,
  size: "md",
};

export function WidgetConfigModal({
  open,
  initial,
  onClose,
  onSave,
}: WidgetConfigModalProps) {
  const [form, setForm] = useState<WidgetConfigFormData>({ ...DEFAULT_FORM, ...initial });
  const [views, setViews] = useState<VistaInfo[]>([]);
  const [loadingViews, setLoadingViews] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ ...DEFAULT_FORM, ...initial });
    setLoadingViews(true);
    fetch("/api/analyst/views", { credentials: "include" })
      .then((r) => r.json())
      .then((data: VistaInfo[]) => setViews(Array.isArray(data) ? data : []))
      .catch(() => setViews([]))
      .finally(() => setLoadingViews(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedView = views.find((v) => v.nombre === form.vista);
  const columns = selectedView?.columnas ?? [];

  function set<K extends keyof WidgetConfigFormData>(
    key: K,
    value: WidgetConfigFormData[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (!form.tipo || !form.vista) return;
    const id = form.id || crypto.randomUUID();
    const titulo = form.titulo.trim() || `Widget ${form.tipo}`;
    onSave({ ...form, id, titulo });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial?.id ? "Editar widget" : "Nuevo widget"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Título del widget</Label>
            <Input
              placeholder="ej: Cosecha por variedad"
              value={form.titulo}
              onChange={(e) => set("titulo", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label>Tipo de gráfica</Label>
            <Select value={form.tipo} onValueChange={(v) => set("tipo", v as WidgetTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WIDGET_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Vista del DWH</Label>
            <Select value={form.vista} onValueChange={(v) => set("vista", v)}>
              <SelectTrigger>
                <SelectValue placeholder={loadingViews ? "Cargando..." : "Seleccionar vista"} />
              </SelectTrigger>
              <SelectContent>
                {views.map((v) => (
                  <SelectItem key={v.nombre} value={v.nombre}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {columns.length > 0 && !["kpi", "tabla"].includes(form.tipo) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Eje X / Dimensión</Label>
                <Select value={form.eje_x} onValueChange={(v) => set("eje_x", v)}>
                  <SelectTrigger><SelectValue placeholder="Columna" /></SelectTrigger>
                  <SelectContent>
                    {columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Eje Y / Métrica</Label>
                <Select value={form.eje_y} onValueChange={(v) => set("eje_y", v)}>
                  <SelectTrigger><SelectValue placeholder="Columna" /></SelectTrigger>
                  <SelectContent>
                    {columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {columns.length > 0 && !["kpi", "tabla", "scatter"].includes(form.tipo) && (
            <div className="space-y-1">
              <Label>Agrupar por (opcional)</Label>
              <Select value={form.grupo_by} onValueChange={(v) => set("grupo_by", v)}>
                <SelectTrigger><SelectValue placeholder="(ninguno)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">(ninguno)</SelectItem>
                  {columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {form.tipo === "forecast" && (
            <div className="space-y-1">
              <Label>Períodos a proyectar</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={form.forecast_periodos}
                onChange={(e) => set("forecast_periodos", Number(e.target.value))}
              />
            </div>
          )}

          <div className="space-y-1">
            <Label>Tamaño en el grid</Label>
            <Select value={form.size} onValueChange={(v) => set("size", v as "sm" | "md" | "lg")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sm">Pequeño (1×1)</SelectItem>
                <SelectItem value="md">Mediano (2×1)</SelectItem>
                <SelectItem value="lg">Grande (2×2)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.tipo || !form.vista}>
            {initial?.id ? "Guardar cambios" : "Agregar widget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
