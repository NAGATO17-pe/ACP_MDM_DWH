"use client";

import * as React from "react";
import { Loader2, Play, TriangleAlert } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/charts/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber } from "@/lib/format";
import {
  useCombinaciones,
  useEjecutarProyeccion,
  useFechasProyeccion,
} from "@/hooks/use-proyecciones";
import type {
  ProyeccionDetalle,
  RespuestaProyeccion,
} from "@/lib/schemas/proyecciones";

const TODOS = "__todos__";

function fmtFecha(idTiempo: number): string {
  const s = String(idTiempo);
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

export function ProyeccionesClient() {
  const fechas = useFechasProyeccion();
  const [idTiempo, setIdTiempo] = React.useState<number | null>(null);
  const [fundo, setFundo] = React.useState(TODOS);
  const [modulo, setModulo] = React.useState(TODOS);
  const [variedad, setVariedad] = React.useState(TODOS);
  const [condicion, setCondicion] = React.useState(TODOS);

  const combinaciones = useCombinaciones(idTiempo);
  const ejecutar = useEjecutarProyeccion();

  React.useEffect(() => {
    if (idTiempo == null && fechas.data?.fechas.length)
      setIdTiempo(fechas.data.fechas[0]);
  }, [fechas.data, idTiempo]);

  const opciones = React.useMemo(() => {
    const rows = combinaciones.data ?? [];
    const uniq = (xs: string[]) => [...new Set(xs)].sort();
    return {
      fundos: uniq(rows.map((r) => r.Fundo)),
      modulos: uniq(rows.map((r) => r.Modulo)),
      variedades: uniq(rows.map((r) => r.Variedad)),
      condiciones: uniq(rows.map((r) => r.Condicion)),
    };
  }, [combinaciones.data]);

  function onProyectar() {
    if (idTiempo == null) return;
    ejecutar.mutate({
      id_tiempo: idTiempo,
      margen_pesimista: 0.9906,
      margen_optimista: 1.0107,
      ...(modulo !== TODOS ? { modulo: Number(modulo) } : {}),
      ...(variedad !== TODOS ? { variedad } : {}),
      ...(condicion !== TODOS ? { condicion } : {}),
      ...(fundo !== TODOS ? { fundo } : {}),
    });
  }

  const r = ejecutar.data;

  return (
    <div className="flex flex-col gap-6">
      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Filtro label="Fecha de evaluación" required>
            <Select
              value={idTiempo != null ? String(idTiempo) : ""}
              onValueChange={(v) => setIdTiempo(Number(v))}
            >
              <SelectTrigger className="h-11 w-44">
                <SelectValue
                  placeholder={fechas.isLoading ? "Cargando…" : "Seleccionar"}
                />
              </SelectTrigger>
              <SelectContent>
                {(fechas.data?.fechas ?? []).map((f) => (
                  <SelectItem key={f} value={String(f)}>
                    {fmtFecha(f)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Filtro>
          <FiltroSelect
            label="Fundo"
            value={fundo}
            onChange={setFundo}
            options={opciones.fundos}
          />
          <FiltroSelect
            label="Módulo"
            value={modulo}
            onChange={setModulo}
            options={opciones.modulos}
          />
          <FiltroSelect
            label="Variedad"
            value={variedad}
            onChange={setVariedad}
            options={opciones.variedades}
          />
          <FiltroSelect
            label="Condición"
            value={condicion}
            onChange={setCondicion}
            options={opciones.condiciones}
          />
          <Button
            className="h-11 gap-2"
            disabled={idTiempo == null || ejecutar.isPending}
            onClick={onProyectar}
          >
            {ejecutar.isPending ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <Play aria-hidden className="h-4 w-4" />
            )}
            Proyectar
          </Button>
        </CardContent>
      </Card>

      {/* Error */}
      {ejecutar.isError ? (
        <Card className="border-[var(--color-destructive)]/30">
          <CardContent className="flex items-center gap-3 pt-6">
            <TriangleAlert
              aria-hidden
              className="h-5 w-5 text-[var(--color-destructive)]"
            />
            <p className="text-sm">{ejecutar.error.message}</p>
            <Button variant="outline" size="sm" onClick={onProyectar}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Resultados */}
      {ejecutar.isPending ? (
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          aria-busy="true"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-md" />
          ))}
        </div>
      ) : r ? (
        <Resultados r={r} />
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[var(--color-text-muted)]">
            Selecciona una fecha de evaluación y pulsa «Proyectar».
          </CardContent>
        </Card>
      )}

      {/* MatrixEditor (Task 9) */}
    </div>
  );
}

function Filtro({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-[var(--color-text-muted)]">
      <span>
        {label}
        {required ? (
          <span aria-hidden className="text-[var(--color-destructive)]">
            {" "}
            *
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

function FiltroSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <Filtro label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Filtro>
  );
}

function Resultados({ r }: { r: RespuestaProyeccion }) {
  const k = r.kpis;
  if (!r.df_semanal.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-[var(--color-text-muted)]">
          Sin conteos fenológicos para esta fecha y filtros. Prueba otra fecha
          de evaluación.
        </CardContent>
      </Card>
    );
  }
  return (
    <>
      <section
        aria-label="KPIs de proyección"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard
          label="Kg proyectados (central)"
          value={formatNumber(Math.round(k.total_base ?? 0))}
        />
        <KpiCard
          label="Rango pesimista – optimista"
          value={`${formatNumber(Math.round(k.total_pes ?? 0))} – ${formatNumber(Math.round(k.total_opt ?? 0))}`}
        />
        <KpiCard
          label="Unidades con datos"
          value={`${k.unidades_cubiertas ?? 0} / ${k.unidades_totales ?? 0}`}
        />
        <KpiCard label="Variedad top" value={k.variedad_top ?? "—"} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Kg proyectados por semana (W1–W6)</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            debounce={50}
          >
            <BarChart
              data={r.df_semanal}
              margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid
                stroke="var(--color-border)"
                strokeOpacity={0.4}
                vertical={false}
              />
              <XAxis dataKey="semana_label" tick={{ fontSize: 12 }} />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v: number) => formatNumber(v)}
              />
              <Tooltip
                formatter={(v) =>
                  `${formatNumber(Math.round(Number(v)))} kg`
                }
              />
              <Legend />
              <Bar
                name="Pesimista"
                dataKey="kg_pesimista"
                fill="var(--color-warning)"
                fillOpacity={0.55}
                radius={[3, 3, 0, 0]}
              />
              <Bar
                name="Central"
                dataKey="kg_proyectados"
                fill="var(--color-primary)"
                radius={[3, 3, 0, 0]}
              />
              <Bar
                name="Optimista"
                dataKey="kg_optimista"
                fill="var(--color-success)"
                fillOpacity={0.55}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <DetalleTable detalle={r.df_detalle ?? []} />
    </>
  );
}

function DetalleTable({ detalle }: { detalle: ProyeccionDetalle[] }) {
  const rows = React.useMemo(() => {
    const map = new Map<
      string,
      {
        fundo: string;
        modulo: number;
        turno: number;
        valvula: string;
        variedad: string;
        condicion: string;
        semanas: number[];
        total: number;
      }
    >();
    for (const d of detalle) {
      const key = `${d.modulo}|${d.turno}|${d.valvula}|${d.variedad}`;
      const acc = map.get(key) ?? {
        fundo: d.fundo,
        modulo: d.modulo,
        turno: d.turno,
        valvula: d.valvula,
        variedad: d.variedad,
        condicion: d.condicion,
        semanas: [0, 0, 0, 0, 0, 0],
        total: 0,
      };
      if (d.semana >= 1 && d.semana <= 6) acc.semanas[d.semana - 1] += d.kg_base;
      acc.total += d.kg_base;
      map.set(key, acc);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [detalle]);

  if (!rows.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalle por unidad ({rows.length})</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b border-[var(--color-border)]/40 text-left text-[var(--color-text-muted)]">
            <tr>
              <th className="px-2 py-2 font-medium">Fundo</th>
              <th className="px-2 py-2 font-medium">Módulo</th>
              <th className="px-2 py-2 font-medium">Turno</th>
              <th className="px-2 py-2 font-medium">Válvula</th>
              <th className="px-2 py-2 font-medium">Variedad</th>
              {[1, 2, 3, 4, 5, 6].map((w) => (
                <th key={w} className="px-2 py-2 text-right font-medium">
                  W{w}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 100).map((u) => (
              <tr
                key={`${u.modulo}-${u.turno}-${u.valvula}-${u.variedad}`}
                className="border-b border-[var(--color-border)]/20 hover:bg-[var(--color-surface-2)]/30"
              >
                <td className="px-2 py-1.5">{u.fundo}</td>
                <td className="px-2 py-1.5 tabular-nums">{u.modulo}</td>
                <td className="px-2 py-1.5 tabular-nums">{u.turno}</td>
                <td className="px-2 py-1.5 tabular-nums">{u.valvula}</td>
                <td className="px-2 py-1.5">{u.variedad}</td>
                {u.semanas.map((kg, i) => (
                  <td key={i} className="px-2 py-1.5 text-right tabular-nums">
                    {kg > 0 ? formatNumber(Math.round(kg)) : "—"}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                  {formatNumber(Math.round(u.total))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 100 ? (
          <p className="pt-2 text-[11px] text-[var(--color-text-muted)]">
            Mostrando 100 de {rows.length} unidades (ordenadas por kg total).
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
