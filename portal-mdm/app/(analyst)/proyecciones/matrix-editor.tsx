"use client";

import * as React from "react";
import { ChevronDown, Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useGuardarMatriz, useMatrizGuardada } from "@/hooks/use-proyecciones";
import type { MatrizInputs } from "@/lib/schemas/proyecciones";

export const MATRIZ_DEFAULT: MatrizInputs = {
  cosechable: { "1": 1.0, "2": null },
  maduras:    { "1": 1.0, "2": null },
  cremas:     { "1": 1.0, "2": null },
  fase_2:     { "1": 0.14, "2": 0.4,  "3": null },
  fase_1:     { "1": 0,    "2": 0,    "3": 0.1, "4": 0.6, "5": null, "6": null },
  verdes:     { "1": 0,    "2": 0,    "3": 0,   "4": 0,   "5": 0.16, "6": 0.17 },
  pequena:    { "1": 0,    "2": 0,    "3": 0,   "4": 0,   "5": 0,    "6": 0    },
};

const ESTADOS: Array<{ key: string; label: string }> = [
  { key: "cosechable", label: "Cosechable" },
  { key: "maduras",    label: "Maduras" },
  { key: "cremas",     label: "Cremas" },
  { key: "fase_2",     label: "Fase 2" },
  { key: "fase_1",     label: "Fase 1" },
  { key: "verdes",     label: "Verdes" },
  { key: "pequena",    label: "Pequeña" },
];

const SEMANAS = ["1", "2", "3", "4", "5", "6"] as const;

function sumaFila(fila: Record<string, number | null>): number {
  return Object.values(fila).reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

export function MatrixEditor({ onMatrizChange }: {
  onMatrizChange?: (m: MatrizInputs) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const guardada = useMatrizGuardada();
  const guardar = useGuardarMatriz();
  const [matriz, setMatriz] = React.useState<MatrizInputs>(MATRIZ_DEFAULT);
  const [errores, setErrores] = React.useState<Record<string, string>>({});
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (guardada.data && Object.keys(guardada.data).length > 0 && !dirty) {
      setMatriz(guardada.data);
    }
  }, [guardada.data, dirty]);

  function setCelda(estado: string, semana: string, raw: string) {
    const v = raw.trim() === "" ? null : Number(raw) / 100;
    setMatriz((prev) => {
      const next = {
        ...prev,
        [estado]: { ...prev[estado], [semana]: (v !== null && Number.isNaN(v)) ? null : v },
      };
      onMatrizChange?.(next);
      return next;
    });
    setDirty(true);
  }

  function validarFila(estado: string) {
    const fila = matriz[estado] ?? {};
    const suma = sumaFila(fila);
    const fueraDeRango = Object.values(fila).some((v) => v != null && (v < 0 || v > 1));
    setErrores((prev) => {
      const next = { ...prev };
      if (fueraDeRango) {
        next[estado] = "Hay valores fuera de 0–100%. Corrige las celdas marcadas.";
      } else if (suma > 1.0001) {
        next[estado] = `La suma es ${(suma * 100).toFixed(0)}% (> 100%). Reduce alguna semana.`;
      } else {
        delete next[estado];
      }
      return next;
    });
  }

  function restaurar() {
    setMatriz(MATRIZ_DEFAULT);
    setErrores({});
    setDirty(true);
    onMatrizChange?.(MATRIZ_DEFAULT);
  }

  const hayErrores = Object.keys(errores).length > 0;

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          className="flex w-full cursor-pointer items-center justify-between text-left"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <CardTitle className="text-sm">Configuración avanzada — matriz de maduración</CardTitle>
          <ChevronDown
            aria-hidden
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </button>
      </CardHeader>
      {open ? (
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-[var(--color-text-muted)]">
            Porcentaje de bayas de cada estado que se cosecha en cada semana.
            Las celdas <span className="font-medium">AUTO</span> se calculan como
            100% − Σ(semanas anteriores). Valores en %.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--color-text-muted)]">
                  <th className="px-2 py-1.5 font-medium">Estado</th>
                  {SEMANAS.map((s) => (
                    <th key={s} className="px-2 py-1.5 text-center font-medium">W{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ESTADOS.map(({ key, label }) => {
                  const fila = matriz[key] ?? {};
                  return (
                    <React.Fragment key={key}>
                      <tr className="border-t border-[var(--color-border)]/20">
                        <td className="px-2 py-1.5 font-medium">{label}</td>
                        {SEMANAS.map((s) => {
                          const hasKey = s in fila;
                          if (!hasKey) {
                            return (
                              <td key={s} className="px-2 py-1.5 text-center text-[var(--color-text-muted)] opacity-40">·</td>
                            );
                          }
                          const v = fila[s];
                          if (v === null) {
                            return (
                              <td key={s} className="px-2 py-1.5 text-center">
                                <span
                                  className="inline-flex rounded border border-dashed border-[var(--color-border)] px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]"
                                  title="Calculada automáticamente: 100% − Σ semanas anteriores"
                                >
                                  auto
                                </span>
                              </td>
                            );
                          }
                          return (
                            <td key={s} className="px-1 py-1.5">
                              <Input
                                inputMode="decimal"
                                aria-label={`${label} semana ${s} (%)`}
                                defaultValue={(v * 100).toFixed(0)}
                                onChange={(e) => setCelda(key, s, e.target.value)}
                                onBlur={() => validarFila(key)}
                                className={cn(
                                  "h-11 w-16 text-center text-xs tabular-nums",
                                  errores[key] && "border-[var(--color-destructive)]",
                                )}
                              />
                            </td>
                          );
                        })}
                      </tr>
                      {errores[key] ? (
                        <tr>
                          <td colSpan={7} className="px-2 pb-1.5">
                            <p role="alert" aria-live="polite" className="text-[11px] text-[var(--color-destructive)]">
                              {errores[key]}
                            </p>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={restaurar}>
              <RotateCcw aria-hidden className="h-3.5 w-3.5" />
              Restaurar defaults
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={hayErrores || guardar.isPending || !dirty}
              onClick={() => guardar.mutate(matriz, { onSuccess: () => setDirty(false) })}
            >
              {guardar.isPending
                ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                : <Save aria-hidden className="h-3.5 w-3.5" />}
              Guardar matriz
            </Button>
            {guardar.isSuccess && !dirty ? (
              <span className="text-[11px] text-[var(--color-text-muted)]" aria-live="polite">Guardada ✓</span>
            ) : null}
            {guardar.isError ? (
              <span role="alert" className="text-[11px] text-[var(--color-destructive)]">
                {(guardar.error as Error).message}
              </span>
            ) : null}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
