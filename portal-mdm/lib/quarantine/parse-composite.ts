/**
 * lib/quarantine/parse-composite.ts
 * =================================
 * El backend persiste registros en cuarentena con dos modos:
 *
 *   - SIMPLE — `columnaOrigen = "ID_Variedad"` y `valorRaw = "ABC"`.
 *     Un solo campo. El UI muestra un único input.
 *
 *   - COMPUESTO — `columnaOrigen = "ID_Geografia,ID_Tiempo,ID_Variedad"`
 *     y `valorRaw = "38936 | 20240326 | 22"`. Cada columna mapea a un
 *     "trozo" del valor separado por `|`. Esto pasa cuando la fila Bronce
 *     viola una FK compuesta o un constraint multi-columna.
 *
 * Sin este parsing el operador veía dos strings paralelos y tenía que
 * zippearlos mentalmente. Esta función:
 *
 *   - Detecta el modo (simple vs. compuesto) y valida coherencia.
 *   - Devuelve pares { columna, raw } listos para renderizar.
 *   - Humaniza el nombre técnico (`ID_Geografia` → "Geografía", "FK").
 *   - Adjunta hints derivados del valor (fecha parseada, número formateado).
 *
 * La función es pura — fácil de testear y reutilizar en futuras vistas
 * de auditoría / detalle de cuarentena.
 */

const DELIM_VALUE = "|";
const DELIM_COLUMN = ",";

export interface QuarantineField {
  /** Nombre técnico tal como vino del backend (ej. "ID_Geografia"). */
  column: string;
  /** Nombre humanizado para mostrar (ej. "Geografía"). */
  label: string;
  /** Pista semántica corta (ej. "FK", "Fecha YYYYMMDD"). Opcional. */
  hint: string | null;
  /** Valor recibido para esta columna. */
  raw: string;
  /** Representación derivada del valor (ej. "26 mar. 2024" para una fecha). */
  derived: string | null;
  /** Si el dominio típico de la columna es numérico. */
  isNumeric: boolean;
  /** True si la columna parece una FK (empieza con ID_ o termina en _ID). */
  isForeignKey: boolean;
}

export interface ParsedComposite {
  kind: "simple" | "composite" | "mismatch";
  fields: QuarantineField[];
  /** Cuando hay mismatch entre columnas y valores, conservamos el raw. */
  rawFallback: string | null;
}

/* -------------------------------------------------------------------------- */
/* API pública                                                                 */
/* -------------------------------------------------------------------------- */

export function parseComposite(
  columnaOrigen: string,
  valorRaw: string,
): ParsedComposite {
  const cols = columnaOrigen
    .split(DELIM_COLUMN)
    .map((c) => c.trim())
    .filter(Boolean);

  if (cols.length <= 1) {
    return {
      kind: "simple",
      fields: [buildField(cols[0] ?? columnaOrigen, valorRaw)],
      rawFallback: null,
    };
  }

  const values = valorRaw.split(DELIM_VALUE).map((v) => v.trim());

  // Mismatch típico: el valor tiene un `|` dentro de un trozo libre, o el
  // dataset cambió. No intentamos adivinar — devolvemos el raw para que
  // el UI muestre el modo crudo (lo que tenía antes).
  if (values.length !== cols.length) {
    return {
      kind: "mismatch",
      fields: [],
      rawFallback: valorRaw,
    };
  }

  return {
    kind: "composite",
    fields: cols.map((c, i) => buildField(c, values[i] ?? "")),
    rawFallback: null,
  };
}

/** Re-ensambla los valores editados en el string canónico que espera el backend. */
export function assembleComposite(
  parsed: ParsedComposite,
  editedValues: string[],
): string {
  if (parsed.kind === "simple") return editedValues[0] ?? "";
  if (parsed.kind === "mismatch") return editedValues[0] ?? "";
  return editedValues.map((v) => v.trim()).join(` ${DELIM_VALUE} `);
}

/* -------------------------------------------------------------------------- */
/* Helpers de humanización                                                     */
/* -------------------------------------------------------------------------- */

const COLUMN_ALIASES: Record<string, { label: string; hint: string }> = {
  ID_Geografia: { label: "Geografía", hint: "FK · zona / lote geográfico" },
  ID_Tiempo: { label: "Fecha", hint: "FK · YYYYMMDD" },
  ID_Variedad: { label: "Variedad", hint: "FK · variedad de cultivo" },
  ID_Lote: { label: "Lote", hint: "FK · lote operativo" },
  ID_Cuadrilla: { label: "Cuadrilla", hint: "FK · cuadrilla de campo" },
  ID_Trabajador: { label: "Trabajador", hint: "FK · trabajador" },
  ID_Cliente: { label: "Cliente", hint: "FK · cliente / contraparte" },
  Rendimiento_kg: { label: "Rendimiento", hint: "kg" },
  Peso_kg: { label: "Peso", hint: "kg" },
  Volumen_kg: { label: "Volumen", hint: "kg" },
  Cantidad: { label: "Cantidad", hint: null as unknown as string },
};

function buildField(column: string, raw: string): QuarantineField {
  const alias = COLUMN_ALIASES[column];
  const isFK = isForeignKeyName(column);
  const isNumeric = looksNumeric(raw);
  const label = alias?.label ?? humanize(column);
  const hint = alias?.hint ?? (isFK ? "FK" : null);
  const derived = deriveSecondary(column, raw);
  return {
    column,
    label,
    hint,
    raw,
    derived,
    isNumeric,
    isForeignKey: isFK,
  };
}

function isForeignKeyName(col: string): boolean {
  return /^ID_/i.test(col) || /_ID$/i.test(col);
}

function looksNumeric(v: string): boolean {
  if (!v) return false;
  // Soporta enteros, decimales con `.` o `,`, separadores de miles ignorados.
  return /^-?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+)?$|^-?\d+(?:[.,]\d+)?$/.test(
    v.trim(),
  );
}

function humanize(col: string): string {
  // ID_Lote_Padre → "Lote Padre"; Volumen_kg → "Volumen Kg"
  return col
    .replace(/^ID_/, "")
    .replace(/_ID$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace(/\bKg\b/, "kg")
    .trim();
}

/**
 * Pista derivada del valor para columnas conocidas:
 *   - `ID_Tiempo = 20240326` → "26 mar. 2024"
 *   - Columnas numéricas grandes → "1.2M filas" / "1,200 kg"
 *
 * Devuelve null si no hay nada útil que mostrar.
 */
function deriveSecondary(column: string, raw: string): string | null {
  if (!raw) return null;

  if (/^ID_Tiempo$/i.test(column) || /^Fecha/i.test(column)) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(raw.trim());
    if (m) {
      const [_, y, mo, d] = m;
      void _;
      const date = new Date(`${y}-${mo}-${d}T00:00:00`);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString("es-PE", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      }
    }
  }

  if (looksNumeric(raw)) {
    const n = Number(raw.replace(/,/g, "."));
    if (!Number.isNaN(n) && Math.abs(n) >= 1000) {
      return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 3 }).format(n);
    }
  }

  return null;
}
