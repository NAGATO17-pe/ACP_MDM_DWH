"use client";

/**
 * components/control-center/quarantine-composite-editor.tsx
 * =========================================================
 * Editor por-columna para registros de cuarentena compuestos.
 *
 * Antes el operador veía:
 *     Columna: ID_Geografia,ID_Tiempo,ID_Variedad,ID_Lote,Rendimiento_kg
 *     Valor:   38936 | 20240326 | 22 | 1 | 8.659
 *     [input]: 38936 | 20240326 | 22 | 1 | 8.659
 *
 * Esto es ininteligible salvo para quien conozca el modelo. Ahora cada
 * fila muestra:
 *     [Geografía]      FK     38936         →  [38936    ]
 *     [Fecha]          FK     20240326      →  [20240326 ]   26 mar. 2024
 *     [Variedad]       FK     22            →  [22       ]
 *     [Lote]           FK     1             →  [1        ]
 *     [Rendimiento]    kg     8.659         →  [8.659    ]   8.659
 *
 * El UI sabe leer el cambio:
 *   - `mode = "view"` → lado derecho es read-only (modo Rechazar).
 *   - `mode = "edit"` → inputs editables, mismo orden que las columnas.
 *
 * Al guardar, el contenedor llama `assembleComposite(parsed, values)` y
 * obtiene el string `a | b | c` que espera el backend.
 *
 * Importante: NO toca `Label`, `Input` ni el sistema de status badges —
 * sólo compone primitivas existentes.
 */

import { useEffect, useId, useState } from "react";
import { KeyRound, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseComposite,
  type ParsedComposite,
  type QuarantineField,
} from "@/lib/quarantine/parse-composite";

interface QuarantineCompositeEditorProps {
  columnaOrigen: string;
  valorRaw: string;
  /** "edit" muestra inputs por columna; "view" sólo lectura. */
  mode: "edit" | "view";
  /** Callback con el array de valores actuales (mismo orden que columnas). */
  onChange: (values: string[]) => void;
}

export function QuarantineCompositeEditor({
  columnaOrigen,
  valorRaw,
  mode,
  onChange,
}: QuarantineCompositeEditorProps) {
  // El parsing es deterministic y barato — lo hacemos al render. Si fuera
  // costoso, useMemo. Pero strings de <500 chars no califican.
  const parsed = parseComposite(columnaOrigen, valorRaw);
  const isComposite = parsed.kind === "composite";

  const [values, setValues] = useState<string[]>(() =>
    parsed.kind === "mismatch"
      ? [parsed.rawFallback ?? valorRaw]
      : parsed.fields.map((f) => f.raw),
  );

  // Notificar al padre del valor inicial (asambla en el primer render).
  useEffect(() => {
    onChange(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(idx: number, next: string) {
    setValues((prev) => {
      const out = prev.slice();
      out[idx] = next;
      onChange(out);
      return out;
    });
  }

  // Modo mismatch / simple: caemos a un input único — la UI queda igual
  // que la versión anterior. Mantenemos compatibilidad con los registros
  // viejos.
  if (parsed.kind !== "composite") {
    return (
      <SimpleEditor
        label={parsed.fields[0]?.label ?? humanizeFallback(columnaOrigen)}
        hint={parsed.fields[0]?.hint ?? null}
        raw={parsed.rawFallback ?? valorRaw}
        value={values[0] ?? ""}
        onChange={(v) => update(0, v)}
        mode={mode}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <CompositeHeader fieldsCount={parsed.fields.length} mode={mode} />
      <ul
        role="list"
        className="flex flex-col divide-y divide-[var(--color-border)] overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)]/30"
      >
        {parsed.fields.map((field, i) => (
          <FieldRow
            key={`${field.column}-${i}`}
            field={field}
            value={values[i] ?? ""}
            onChange={(v) => update(i, v)}
            mode={mode}
          />
        ))}
      </ul>
      {isComposite ? (
        <CompositePreview parsed={parsed} values={values} mode={mode} />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Subcomponentes                                                              */
/* -------------------------------------------------------------------------- */

function CompositeHeader({
  fieldsCount,
  mode,
}: {
  fieldsCount: number;
  mode: "edit" | "view";
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
        {mode === "edit"
          ? `Valores recibidos · ${fieldsCount} columnas`
          : `Valores recibidos · ${fieldsCount} columnas`}
      </h3>
      <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
        {mode === "edit" ? (
          <>
            <Pencil aria-hidden className="h-3 w-3" />
            edita cada columna por separado
          </>
        ) : (
          "lectura"
        )}
      </span>
    </div>
  );
}

function FieldRow({
  field,
  value,
  onChange,
  mode,
}: {
  field: QuarantineField;
  value: string;
  onChange: (v: string) => void;
  mode: "edit" | "view";
}) {
  const id = useId();
  const changed = mode === "edit" && value.trim() !== field.raw.trim();
  return (
    <li className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-3 py-2 sm:grid-cols-[1.1fr_minmax(120px,auto)_1.2fr]">
      {/* Columna 1 — etiqueta humana */}
      <div className="flex min-w-0 flex-col gap-0.5">
        <label
          htmlFor={id}
          className="truncate text-[13px] font-medium text-[var(--color-text)]"
          title={field.column}
        >
          {field.label}
        </label>
        <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
          {field.isForeignKey ? (
            <KeyRound aria-hidden className="h-3 w-3 text-[var(--color-info)]" />
          ) : null}
          <span className="truncate font-mono" title={field.column}>
            {field.column}
          </span>
          {field.hint && field.hint !== "FK" ? (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{field.hint}</span>
            </>
          ) : null}
        </span>
      </div>

      {/* Columna 2 — valor recibido (read-only) */}
      <div className="flex flex-col items-end gap-0.5 sm:items-start">
        <span
          className={cn(
            "inline-flex max-w-full items-center rounded border border-[color-mix(in_oklab,var(--color-destructive)_28%,transparent)] bg-[color-mix(in_oklab,var(--color-destructive)_6%,transparent)] px-2 py-0.5 font-mono text-[12px]",
            "text-[var(--color-text)]",
            field.isNumeric && "tabular-nums",
          )}
          title={field.raw}
        >
          <span className="truncate">{field.raw || "—"}</span>
        </span>
        {field.derived ? (
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {field.derived}
          </span>
        ) : null}
      </div>

      {/* Columna 3 — input canónico */}
      <div className="flex min-w-0 flex-col gap-0.5">
        {mode === "edit" ? (
          <input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            inputMode={field.isNumeric ? "decimal" : "text"}
            spellCheck={false}
            aria-label={`Valor canónico para ${field.label}`}
            className={cn(
              "h-7 w-full rounded border bg-[var(--color-surface)] px-2 font-mono text-[12px]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]",
              changed
                ? "border-[var(--color-primary)] ring-1 ring-[color-mix(in_oklab,var(--color-primary)_25%,transparent)]"
                : "border-[var(--color-border)]",
              field.isNumeric && "tabular-nums",
            )}
            placeholder={field.raw}
          />
        ) : (
          <span
            className={cn(
              "truncate rounded border border-dashed border-[var(--color-border)] px-2 py-0.5 font-mono text-[12px] text-[var(--color-text-muted)]",
              field.isNumeric && "tabular-nums",
            )}
          >
            {field.raw || "—"}
          </span>
        )}
        {changed ? (
          <span className="text-[10px] text-[var(--color-primary)]">
            modificado
          </span>
        ) : null}
      </div>
    </li>
  );
}

function CompositePreview({
  parsed,
  values,
  mode,
}: {
  parsed: ParsedComposite;
  values: string[];
  mode: "edit" | "view";
}) {
  const preview = values.map((v) => v.trim()).join(" | ");
  const allEqual =
    parsed.kind === "composite" &&
    parsed.fields.every((f, i) => f.raw.trim() === (values[i] ?? "").trim());
  if (mode !== "edit") return null;
  return (
    <div className="flex flex-col gap-1 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
        Vista previa del valor canónico que se guardará
      </span>
      <span
        className={cn(
          "break-all font-mono text-[11px]",
          allEqual
            ? "text-[var(--color-text-muted)]"
            : "text-[var(--color-primary)]",
        )}
      >
        {preview}
      </span>
      {allEqual ? (
        <span className="text-[10px] italic text-[var(--color-text-muted)]">
          Idéntico al valor recibido — no cambia el dato, sólo lo aprueba como
          canónico.
        </span>
      ) : null}
    </div>
  );
}

function SimpleEditor({
  label,
  hint,
  raw,
  value,
  onChange,
  mode,
}: {
  label: string;
  hint: string | null;
  raw: string;
  value: string;
  onChange: (v: string) => void;
  mode: "edit" | "view";
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-[13px] font-medium text-[var(--color-text)]"
      >
        {label}
        {hint ? (
          <span className="ml-2 text-[10px] text-[var(--color-text-muted)]">
            {hint}
          </span>
        ) : null}
      </label>
      <div className="flex flex-col gap-1.5">
        <div className="rounded border border-[color-mix(in_oklab,var(--color-destructive)_28%,transparent)] bg-[color-mix(in_oklab,var(--color-destructive)_6%,transparent)] px-3 py-1.5 font-mono text-[12px]">
          <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
            recibido
          </span>
          <div className="break-all text-[var(--color-text)]">
            {raw || "(vacío)"}
          </div>
        </div>
        {mode === "edit" ? (
          <input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={200}
            spellCheck={false}
            placeholder={raw || "Valor canónico"}
            className="h-9 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 font-mono text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        ) : null}
      </div>
    </div>
  );
}

function humanizeFallback(col: string): string {
  return col
    .replace(/^ID_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}
