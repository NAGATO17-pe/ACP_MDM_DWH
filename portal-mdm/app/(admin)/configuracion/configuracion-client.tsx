"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Cog,
  Loader2,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sliders,
  UserCheck,
  UserCircle,
  UserX,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import {
  ROL_LABEL,
  tieneRolMinimo,
  type BackendRol,
  type Parametro,
  type Perfil,
  type Regla,
  type Usuario,
} from "@/lib/schemas/configuracion";
import {
  useParametros,
  useProfile,
  useReglas,
  useToggleUser,
  useUpdateParametro,
  useUsuarios,
} from "@/hooks/use-configuracion";
import { CambiarClaveDialog } from "@/components/control-center/cambiar-clave-dialog";
import { NuevoUsuarioDialog } from "@/components/control-center/nuevo-usuario-dialog";
import { usePreferencias } from "@/components/providers/preferencias-provider";
import { useToast } from "@/hooks/use-toast";

export function ConfiguracionClient() {
  const profile = useProfile();

  return (
    <div className="flex flex-col gap-6">
      <PerfilCard perfil={profile.data} loading={profile.isLoading} error={profile.error} />

      <PreferenciasCard />

      {/* Las siguientes secciones requieren rol mínimo — las renderizamos
          solo si el rol del usuario alcanza el umbral. El backend hace el
          gating real; aquí solo evitamos llamadas y UI inútil. */}
      {profile.data && tieneRolMinimo(profile.data.rol, "analista_mdm") ? (
        <>
          <ParametrosCard />
          <ReglasCard />
        </>
      ) : null}

      {profile.data && tieneRolMinimo(profile.data.rol, "admin") ? (
        <UsuariosCard perfil={profile.data} />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Card 1: Perfil                                                             */
/* -------------------------------------------------------------------------- */

function PerfilCard({
  perfil,
  loading,
  error,
}: {
  perfil: Perfil | undefined;
  loading: boolean;
  error: unknown;
}) {
  return (
    <SectionCard
      icon={<UserCircle aria-hidden className="h-5 w-5" />}
      title="Mi perfil"
      description="Datos del usuario con el que iniciaste sesión."
    >
      {loading ? (
        <Skeleton className="h-20 w-full rounded-md" />
      ) : error || !perfil ? (
        <ErrorInline message={error instanceof Error ? error.message : "Sin perfil"} />
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <dl className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
            <KV label="Nombre completo" value={perfil.nombreDisplay} />
            <KV label="Usuario" value={perfil.nombreUsuario} mono />
            <KV
              label="Rol"
              value={
                <Badge variant="info" className="gap-1">
                  <Shield aria-hidden className="h-3 w-3" />
                  {ROL_LABEL[perfil.rol]}
                </Badge>
              }
            />
            <KV
              label="Correo"
              value={
                perfil.email ?? (
                  <span className="text-[var(--color-text-muted)]">Sin correo asignado</span>
                )
              }
            />
          </dl>
          <CambiarClaveDialog />
        </div>
      )}
    </SectionCard>
  );
}

/* -------------------------------------------------------------------------- */
/* Card 2: Preferencias                                                       */
/* -------------------------------------------------------------------------- */

function PreferenciasCard() {
  const prefs = usePreferencias();
  return (
    <SectionCard
      icon={<Sliders aria-hidden className="h-5 w-5" />}
      title="Preferencias del portal"
      description="Se guardan en este navegador. Solo afectan tu sesión."
    >
      <div className="flex flex-col gap-5">
        <PreferenciaRow
          label="Densidad de tablas"
          help="Compacta muestra más filas en pantalla. Cómoda mejora la legibilidad."
        >
          <RadioToggle
            options={[
              { value: "comoda", label: "Cómoda" },
              { value: "compacta", label: "Compacta" },
            ]}
            value={prefs.densidad}
            onChange={(v) => prefs.setDensidad(v as "comoda" | "compacta")}
            ariaLabel="Densidad de tablas"
          />
        </PreferenciaRow>

        <PreferenciaRow
          label="Tema"
          help="«Sistema» respeta tu preferencia del sistema operativo (oscuro/claro)."
        >
          <RadioToggle
            options={[
              { value: "oscuro", label: "Oscuro" },
              { value: "sistema", label: "Sistema" },
            ]}
            value={prefs.tema}
            onChange={(v) => prefs.setTema(v as "oscuro" | "sistema")}
            ariaLabel="Tema visual"
          />
        </PreferenciaRow>

        <PreferenciaRow
          label="Recordar pestaña activa"
          help="Al volver a una página con tabs (Catálogos, Bitácora) reabre la pestaña que dejaste."
        >
          <RadioToggle
            options={[
              { value: "si", label: "Sí" },
              { value: "no", label: "No" },
            ]}
            value={prefs.recordarTabs ? "si" : "no"}
            onChange={(v) => prefs.setRecordarTabs(v === "si")}
            ariaLabel="Recordar pestaña activa"
          />
        </PreferenciaRow>
      </div>
    </SectionCard>
  );
}

function PreferenciaRow({
  label,
  help,
  children,
}: {
  label: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
        <span className="max-w-md text-xs text-[var(--color-text-muted)]">{help}</span>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function RadioToggle({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-[32px] rounded px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
            value === o.value
              ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Card 3: Parámetros del pipeline                                            */
/* -------------------------------------------------------------------------- */

function ParametrosCard() {
  const query = useParametros();
  const datos = useMemo<Parametro[]>(() => query.data?.datos ?? [], [query.data]);

  return (
    <SectionCard
      icon={<Cog aria-hidden className="h-5 w-5" />}
      title="Parámetros del pipeline"
      description="Variables de control del ETL. Los cambios se aplican en la siguiente corrida."
      actions={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => query.refetch()}
          className="gap-1.5"
        >
          <RefreshCw
            aria-hidden
            className={cn("h-3.5 w-3.5", query.isFetching && "animate-spin")}
          />
          Refrescar
        </Button>
      }
    >
      {query.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-md" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorInline
          message={query.error instanceof Error ? query.error.message : "Error al cargar"}
        />
      ) : datos.length === 0 ? (
        <EmptyInline message="No hay parámetros configurados." />
      ) : (
        <ul className="flex flex-col gap-2">
          {datos.map((p) => (
            <ParametroRow key={p.nombre} parametro={p} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function ParametroRow({ parametro }: { parametro: Parametro }) {
  // Patrón "derived state during render" (React docs): guardamos el
  // override local junto al valor del servidor que vio el usuario; si
  // el servidor cambia (refetch), descartamos el override automática-
  // mente. Mantiene foco entre tipeos y evita `setState` en effect.
  const [override, setOverride] = useState<{ base: string; value: string } | null>(
    null,
  );
  const valor =
    override !== null && override.base === parametro.valor
      ? override.value
      : parametro.valor;
  const dirty = valor.trim() !== parametro.valor.trim();
  const mutation = useUpdateParametro();
  const { toast } = useToast();

  function guardar() {
    if (!dirty || mutation.isPending) return;
    mutation.mutate(
      { nombre: parametro.nombre, valor: valor.trim() },
      {
        onSuccess: (res) =>
          toast({ variant: "success", title: res.mensaje }),
        onError: (err) =>
          toast({
            variant: "destructive",
            title: "No se pudo guardar",
            description: err instanceof Error ? err.message : String(err),
          }),
      },
    );
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-medium text-[var(--color-text)]">
          {parametro.nombre}
        </p>
        {parametro.descripcion ? (
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            {parametro.descripcion}
          </p>
        ) : null}
        {parametro.fechaModificacion ? (
          <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
            Modificado {formatDateTime(parametro.fechaModificacion)}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:w-[280px]">
        <Input
          value={valor}
          onChange={(e) =>
            setOverride({ base: parametro.valor, value: e.target.value })
          }
          maxLength={500}
          aria-label={`Valor de ${parametro.nombre}`}
          className="font-mono text-[13px]"
        />
        {dirty ? (
          <Button
            size="sm"
            onClick={guardar}
            disabled={mutation.isPending}
            aria-busy={mutation.isPending}
            className="gap-1"
          >
            {mutation.isPending ? (
              <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check aria-hidden className="h-3.5 w-3.5" />
            )}
            Guardar
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Card 4: Reglas de validación                                               */
/* -------------------------------------------------------------------------- */

function ReglasCard() {
  const query = useReglas();
  const datos = useMemo<Regla[]>(() => query.data?.datos ?? [], [query.data]);

  // Agrupar por tabla_destino para una lectura por dominio.
  const grupos = useMemo(() => {
    const m = new Map<string, Regla[]>();
    for (const r of datos) {
      const k = r.tablaDestino ?? "(sin tabla)";
      const arr = m.get(k);
      if (arr) arr.push(r);
      else m.set(k, [r]);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [datos]);

  const kpis = query.data?.kpis;

  return (
    <SectionCard
      icon={<ShieldCheck aria-hidden className="h-5 w-5" />}
      title="Reglas de validación"
      description="Reglas que el ETL aplica al pasar datos de Bronce a Silver. Solo lectura."
    >
      {kpis ? (
        <div className="mb-3 grid grid-cols-3 gap-2">
          <KpiTile label="Total" value={kpis.total} />
          <KpiTile label="Activas" value={kpis.activas} tone="success" />
          <KpiTile label="Inactivas" value={kpis.inactivas} tone="muted" />
        </div>
      ) : null}

      {query.isLoading ? (
        <Skeleton className="h-32 w-full rounded-md" />
      ) : query.isError ? (
        <ErrorInline
          message={query.error instanceof Error ? query.error.message : "Error al cargar"}
        />
      ) : grupos.length === 0 ? (
        <EmptyInline message="No hay reglas configuradas." />
      ) : (
        <div className="flex flex-col gap-3">
          {grupos.map(([tabla, reglas]) => (
            <details
              key={tabla}
              open
              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]"
            >
              <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-2)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]">
                <span className="font-mono">{tabla}</span>{" "}
                <span className="text-xs text-[var(--color-text-muted)]">
                  · {reglas.length} regla{reglas.length === 1 ? "" : "s"}
                </span>
              </summary>
              <div className="overflow-x-auto border-t border-[var(--color-border)]">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--color-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Columna</th>
                      <th className="px-3 py-2 font-medium">Tipo</th>
                      <th className="px-3 py-2 text-right font-medium">Mínimo</th>
                      <th className="px-3 py-2 text-right font-medium">Máximo</th>
                      <th className="px-3 py-2 font-medium">Acción si falla</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reglas.map((r, i) => (
                      <tr
                        key={`${r.columna}-${r.tipoValidacion}-${i}`}
                        className="border-t border-[var(--color-border)]"
                      >
                        <td className="px-3 py-2 font-mono text-[13px]">
                          {r.columna ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                          {tipoLegible(r.tipoValidacion)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.valorMin ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.valorMax ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                          {accionLegible(r.accion)}
                        </td>
                        <td className="px-3 py-2">
                          {r.activa ? (
                            <Badge variant="success">Activa</Badge>
                          ) : (
                            <Badge variant="default" className="opacity-70">
                              Inactiva
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function tipoLegible(t: string | null): string {
  if (!t) return "—";
  const tabla: Record<string, string> = {
    RANGO: "Rango numérico",
    NO_NULO: "No nulo",
    REGEX: "Patrón (regex)",
    DOMINIO: "Lista de valores",
    LONGITUD: "Longitud máxima",
    UNICO: "Único",
  };
  return tabla[t.toUpperCase()] ?? t;
}

function accionLegible(a: string | null): string {
  if (!a) return "—";
  const tabla: Record<string, string> = {
    RECHAZAR: "Rechazar fila",
    CUARENTENA: "Mandar a cuarentena",
    WARN: "Advertir y dejar pasar",
    LOG: "Solo registrar",
  };
  return tabla[a.toUpperCase()] ?? a;
}

/* -------------------------------------------------------------------------- */
/* Card 5: Usuarios (admin)                                                   */
/* -------------------------------------------------------------------------- */

function UsuariosCard({ perfil }: { perfil: Perfil }) {
  const query = useUsuarios({ enabled: true });
  const items = useMemo<Usuario[]>(() => query.data ?? [], [query.data]);

  return (
    <SectionCard
      icon={<Users aria-hidden className="h-5 w-5" />}
      title="Usuarios del sistema"
      description="Gestión completa de cuentas. Solo administradores."
      actions={<NuevoUsuarioDialog />}
    >
      {query.isLoading ? (
        <Skeleton className="h-32 w-full rounded-md" />
      ) : query.isError ? (
        <ErrorInline
          message={query.error instanceof Error ? query.error.message : "Error al cargar"}
        />
      ) : items.length === 0 ? (
        <EmptyInline message="No hay usuarios cargados." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre completo</th>
                <th className="px-3 py-2 font-medium">Usuario</th>
                <th className="px-3 py-2 font-medium">Correo</th>
                <th className="px-3 py-2 font-medium">Rol</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium">Creado</th>
                <th className="px-3 py-2 font-medium">Último acceso</th>
                <th className="px-3 py-2 sr-only">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <UsuarioRow
                  key={u.idUsuario}
                  usuario={u}
                  esElMismo={u.nombreUsuario === perfil.nombreUsuario}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function UsuarioRow({
  usuario,
  esElMismo,
}: {
  usuario: Usuario;
  esElMismo: boolean;
}) {
  const toggle = useToggleUser();
  const { toast } = useToast();
  const busy = toggle.isPending && toggle.variables?.nombre === usuario.nombreUsuario;

  function cambiarEstado() {
    if (busy) return;
    toggle.mutate(
      { nombre: usuario.nombreUsuario, activar: !usuario.esActivo },
      {
        onSuccess: (res) => toast({ variant: "success", title: res.mensaje }),
        onError: (err) =>
          toast({
            variant: "destructive",
            title: "No se pudo cambiar",
            description: err instanceof Error ? err.message : String(err),
          }),
      },
    );
  }

  return (
    <tr className="border-t border-[var(--color-border)] transition hover:bg-[var(--color-surface-2)]/40">
      <td className="px-3 py-2 font-medium">{usuario.nombreDisplay}</td>
      <td className="px-3 py-2 font-mono text-[13px]">{usuario.nombreUsuario}</td>
      <td className="px-3 py-2 text-[var(--color-text-secondary)]">
        {usuario.email ?? "—"}
      </td>
      <td className="px-3 py-2">
        <Badge variant="info">{ROL_LABEL[usuario.rol as BackendRol] ?? usuario.rol}</Badge>
      </td>
      <td className="px-3 py-2">
        {usuario.esActivo ? (
          <Badge variant="success" className="gap-1">
            <UserCheck aria-hidden className="h-3 w-3" />
            Activo
          </Badge>
        ) : (
          <Badge variant="default" className="gap-1 opacity-80">
            <UserX aria-hidden className="h-3 w-3" />
            Inactivo
          </Badge>
        )}
      </td>
      <td className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
        {usuario.fechaCreacion ? formatDateTime(usuario.fechaCreacion) : "—"}
      </td>
      <td className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
        {usuario.ultimoAcceso ? formatDateTime(usuario.ultimoAcceso) : "Nunca"}
      </td>
      <td className="px-3 py-2 text-right">
        {esElMismo ? (
          <span
            className="text-[11px] text-[var(--color-text-muted)]"
            title="No puedes desactivar tu propia cuenta"
          >
            (tú)
          </span>
        ) : (
          <Button
            variant={usuario.esActivo ? "ghost" : "outline"}
            size="sm"
            onClick={cambiarEstado}
            disabled={busy}
            aria-busy={busy}
            className="h-7 px-2 text-xs"
          >
            {busy ? (
              <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            {usuario.esActivo ? "Desactivar" : "Activar"}
          </Button>
        )}
      </td>
    </tr>
  );
}

/* -------------------------------------------------------------------------- */
/* Subcomponentes compartidos                                                 */
/* -------------------------------------------------------------------------- */

function SectionCard({
  icon,
  title,
  description,
  actions,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <header className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-2)] text-[var(--color-primary)]"
          >
            {icon}
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-semibold text-[var(--color-text)]">
              {title}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)]">{description}</p>
          </div>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}

function KV({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </dt>
      <dd
        className={cn(
          "truncate text-sm text-[var(--color-text)]",
          mono && "font-mono",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function KpiTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "muted";
}) {
  const color =
    tone === "success"
      ? "text-[var(--color-success)]"
      : tone === "muted"
        ? "text-[var(--color-text-muted)]"
        : "text-[var(--color-text)]";
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className={cn("mt-0.5 text-lg font-bold tabular-nums", color)}>
        {value}
      </p>
    </div>
  );
}

function ErrorInline({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-[var(--color-destructive)]/40 bg-[color-mix(in_oklab,var(--color-destructive)_8%,transparent)] px-3 py-2 text-sm text-[var(--color-destructive)]"
    >
      <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function EmptyInline({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-6 text-center text-sm text-[var(--color-text-muted)]">
      {message}
    </div>
  );
}
