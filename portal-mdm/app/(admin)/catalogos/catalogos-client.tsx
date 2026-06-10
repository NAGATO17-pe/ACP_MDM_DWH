"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Grape,
  Loader2,
  MapPinned,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import {
  useDesactivarVariedad,
  useGeografia,
  usePersonal,
  useReactivarVariedad,
  useVariedadesDim,
  useVariedadesMdm,
} from "@/hooks/use-catalogos";
import type {
  Geografia,
  Personal,
  VariedadDim,
  VariedadMdm,
} from "@/lib/schemas/catalogos";
import { NuevaVariedadDialog } from "@/components/control-center/nueva-variedad-dialog";
import { useToast } from "@/hooks/use-toast";
import { useUrlState } from "@/hooks/use-url-state";

type TabId = "variedades" | "geografia" | "personal";

const PAGE_SIZES = [25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];

interface CatalogosClientProps {
  isReadOnly?: boolean;
}

export function CatalogosClient({ isReadOnly = false }: CatalogosClientProps) {
  const [{ tab: rawTab }, setUrlState] = useUrlState({ tab: "variedades" });
  const tab: TabId = (["variedades", "geografia", "personal"] as TabId[]).includes(
    rawTab as TabId,
  )
    ? (rawTab as TabId)
    : "variedades";
  function setTab(t: TabId) { setUrlState({ tab: t }); }

  return (
    <div className="flex flex-col gap-5">
      <nav
        role="tablist"
        aria-label="Catálogos"
        className="flex items-center gap-1 border-b border-[var(--color-border)]"
      >
        <TabButton
          active={tab === "variedades"}
          icon={<Grape aria-hidden className="h-4 w-4" />}
          onClick={() => setTab("variedades")}
        >
          Variedades
        </TabButton>
        <TabButton
          active={tab === "geografia"}
          icon={<MapPinned aria-hidden className="h-4 w-4" />}
          onClick={() => setTab("geografia")}
        >
          Geografía
        </TabButton>
        <TabButton
          active={tab === "personal"}
          icon={<Users aria-hidden className="h-4 w-4" />}
          onClick={() => setTab("personal")}
        >
          Personal
        </TabButton>
      </nav>

      {tab === "variedades" ? (
        <VariedadesSection isReadOnly={isReadOnly} />
      ) : tab === "geografia" ? (
        <GeografiaSection />
      ) : (
        <PersonalSection />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sección: Variedades (subtab MDM vs DWH)                                    */
/* -------------------------------------------------------------------------- */

function VariedadesSection({ isReadOnly = false }: { isReadOnly?: boolean }) {
  const [sub, setSub] = useState<"mdm" | "dim">("dim");

  return (
    <section className="flex flex-col gap-4" aria-label="Variedades">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Origen de variedades"
          className="inline-flex w-fit items-center gap-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5"
        >
          <SubTab active={sub === "dim"} onClick={() => setSub("dim")}>
            Dimensión DWH
          </SubTab>
          <SubTab active={sub === "mdm"} onClick={() => setSub("mdm")}>
            Catálogo MDM
          </SubTab>
        </div>
        {sub === "dim" && !isReadOnly ? <NuevaVariedadDialog /> : null}
      </div>

      <p className="text-xs text-[var(--color-text-muted)]">
        {sub === "dim" ? (
          <>
            Variedades ya homologadas y disponibles para hechos del DWH
            (<span className="font-mono">Silver.Dim_Variedad</span>). Editable
            por administradores.
          </>
        ) : (
          <>
            Catálogo maestro MDM crudo
            (<span className="font-mono">MDM.Catalogo_Variedades</span>) — solo lectura.
          </>
        )}
      </p>

      {sub === "dim" ? <VariedadesDimTabla isReadOnly={isReadOnly} /> : <VariedadesMdmTabla />}
    </section>
  );
}

/* ---- Variedades Dim (Silver) -------------------------------------------- */

function VariedadesDimTabla({ isReadOnly = false }: { isReadOnly?: boolean }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [filtro, setFiltro] = useState("");
  const query = useVariedadesDim({ pagina: page, tamano: pageSize });
  const { toast } = useToast();
  const desactivar = useDesactivarVariedad();
  const reactivar = useReactivarVariedad();

  const items = useMemo<VariedadDim[]>(
    () => query.data?.datos ?? [],
    [query.data],
  );
  const filtrados = useMemo(
    () => filtrarPorTexto(items, filtro, (v) => `${v.nombreVariedad} ${v.breeder ?? ""}`),
    [items, filtro],
  );

  function aplicar(idVariedad: number, accion: "desactivar" | "reactivar") {
    const mut = accion === "desactivar" ? desactivar : reactivar;
    mut.mutate(
      { idVariedad },
      {
        onSuccess: (res) =>
          toast({ variant: "success", title: res.mensaje }),
        onError: (err) =>
          toast({
            variant: "destructive",
            title: `No se pudo ${accion}`,
            description: err instanceof Error ? err.message : String(err),
          }),
      },
    );
  }

  return (
    <CatalogoLayout
      page={page}
      pageSize={pageSize}
      onPage={setPage}
      onPageSize={(n) => {
        setPageSize(n);
        setPage(1);
      }}
      total={query.data?.total ?? 0}
      visible={filtrados.length}
      filtro={filtro}
      setFiltro={setFiltro}
      placeholder="Buscar por variedad o breeder…"
      onRefresh={() => query.refetch()}
      isFetching={query.isFetching}
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
    >
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
          <tr>
            <th className="px-3 py-2 font-medium">ID</th>
            <th className="px-3 py-2 font-medium">Variedad</th>
            <th className="px-3 py-2 font-medium">Breeder</th>
            <th className="px-3 py-2 font-medium">Estado</th>
            <th className="px-3 py-2 font-medium">Creada</th>
            <th className="px-3 py-2 font-medium">Modificada</th>
            {!isReadOnly && <th className="px-3 py-2 sr-only">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {filtrados.map((v) => {
            const busy =
              (desactivar.isPending &&
                desactivar.variables?.idVariedad === v.idVariedad) ||
              (reactivar.isPending &&
                reactivar.variables?.idVariedad === v.idVariedad);
            return (
              <tr
                key={v.idVariedad}
                className="border-t border-[var(--color-border)] transition hover:bg-[var(--color-surface-2)]/60"
              >
                <td className="px-3 py-2 font-mono text-xs text-[var(--color-text-muted)]">
                  {v.idVariedad}
                </td>
                <td className="px-3 py-2 font-medium">{v.nombreVariedad}</td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                  {v.breeder ?? <span className="text-[var(--color-text-muted)]">—</span>}
                </td>
                <td className="px-3 py-2">
                  <EstadoActivoBadge activa={v.esActiva} />
                </td>
                <td className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                  {v.fechaCreacion ? formatDateTime(v.fechaCreacion) : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                  {v.fechaModificacion ? formatDateTime(v.fechaModificacion) : "—"}
                </td>
                {!isReadOnly && (
                  <td className="px-3 py-2 text-right">
                    {v.esActiva ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => aplicar(v.idVariedad, "desactivar")}
                        disabled={busy}
                        aria-busy={busy}
                        className="h-7 px-2 text-xs"
                      >
                        {busy ? (
                          <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Desactivar
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => aplicar(v.idVariedad, "reactivar")}
                        disabled={busy}
                        aria-busy={busy}
                        className="h-7 px-2 text-xs"
                      >
                        {busy ? (
                          <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Reactivar
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </CatalogoLayout>
  );
}

/* ---- Variedades MDM (Catalogo_Variedades) ------------------------------- */

function VariedadesMdmTabla() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [filtro, setFiltro] = useState("");
  const query = useVariedadesMdm({ pagina: page, tamano: pageSize });

  const items = useMemo<VariedadMdm[]>(
    () => query.data?.datos ?? [],
    [query.data],
  );
  const filtrados = useMemo(
    () => filtrarPorTexto(items, filtro, (v) => `${v.nombreCanonico} ${v.breeder ?? ""}`),
    [items, filtro],
  );

  return (
    <CatalogoLayout
      page={page}
      pageSize={pageSize}
      onPage={setPage}
      onPageSize={(n) => {
        setPageSize(n);
        setPage(1);
      }}
      total={query.data?.total ?? 0}
      visible={filtrados.length}
      filtro={filtro}
      setFiltro={setFiltro}
      placeholder="Buscar por nombre canónico o breeder…"
      onRefresh={() => query.refetch()}
      isFetching={query.isFetching}
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
    >
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
          <tr>
            <th className="px-3 py-2 font-medium">Nombre canónico</th>
            <th className="px-3 py-2 font-medium">Breeder (casa propietaria)</th>
            <th className="px-3 py-2 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {filtrados.map((v) => (
            <tr
              key={v.nombreCanonico}
              className="border-t border-[var(--color-border)] transition hover:bg-[var(--color-surface-2)]/60"
            >
              <td className="px-3 py-2 font-medium">{v.nombreCanonico}</td>
              <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                {v.breeder ?? <span className="text-[var(--color-text-muted)]">—</span>}
              </td>
              <td className="px-3 py-2">
                <EstadoActivoBadge activa={v.esActiva} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </CatalogoLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* Sección: Geografía                                                         */
/* -------------------------------------------------------------------------- */

function GeografiaSection() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [filtro, setFiltro] = useState("");
  const query = useGeografia({ pagina: page, tamano: pageSize });

  const items = useMemo<Geografia[]>(
    () => query.data?.datos ?? [],
    [query.data],
  );
  const filtrados = useMemo(
    () =>
      filtrarPorTexto(
        items,
        filtro,
        (g) =>
          `${g.fundo ?? ""} ${g.sector ?? ""} ${g.modulo ?? ""} ${g.valvula ?? ""} ${g.cama ?? ""} ${g.codigoSapCampo ?? ""}`,
      ),
    [items, filtro],
  );

  return (
    <section aria-label="Geografía agrícola" className="flex flex-col gap-4">
      <p className="text-xs text-[var(--color-text-muted)]">
        Estructura física de la operación agrícola
        (<span className="font-mono">Silver.Dim_Geografia</span>). Solo se muestran
        ubicaciones vigentes.
      </p>
      <CatalogoLayout
        page={page}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        total={query.data?.total ?? 0}
        visible={filtrados.length}
        filtro={filtro}
        setFiltro={setFiltro}
        placeholder="Buscar por fundo, sector, válvula, código SAP…"
        onRefresh={() => query.refetch()}
        isFetching={query.isFetching}
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
      >
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Fundo</th>
              <th className="px-3 py-2 font-medium">Sector</th>
              <th className="px-3 py-2 text-right font-medium">Módulo</th>
              <th className="px-3 py-2 text-right font-medium">Turno</th>
              <th className="px-3 py-2 font-medium">Válvula</th>
              <th className="px-3 py-2 font-medium">Cama</th>
              <th className="px-3 py-2 font-medium">Código SAP</th>
              <th className="px-3 py-2 font-medium">Bloque de prueba</th>
              <th className="px-3 py-2 font-medium">Vigencia</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((g, i) => (
              <tr
                key={`${g.fundo}-${g.sector}-${g.modulo}-${g.valvula}-${g.cama}-${i}`}
                className="border-t border-[var(--color-border)] transition hover:bg-[var(--color-surface-2)]/60"
              >
                <td className="px-3 py-2 font-medium">
                  {g.fundo ?? <span className="text-[var(--color-text-muted)]">—</span>}
                </td>
                <td className="px-3 py-2">{g.sector ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {g.modulo ?? "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {g.turno ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-[13px]">
                  {g.valvula ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-[13px]">
                  {g.cama ?? "—"}
                </td>
                <td className="px-3 py-2 font-mono text-[13px] text-[var(--color-text-muted)]">
                  {g.codigoSapCampo ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {g.esTestBlock ? (
                    <Badge variant="warning">Sí</Badge>
                  ) : (
                    <span className="text-xs text-[var(--color-text-muted)]">No</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {g.esVigente ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 aria-hidden className="h-3 w-3" />
                      Vigente
                    </Badge>
                  ) : (
                    <Badge variant="default">Histórica</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CatalogoLayout>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Sección: Personal                                                          */
/* -------------------------------------------------------------------------- */

function PersonalSection() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [filtro, setFiltro] = useState("");
  const query = usePersonal({ pagina: page, tamano: pageSize });

  const items = useMemo<Personal[]>(
    () => query.data?.datos ?? [],
    [query.data],
  );
  const filtrados = useMemo(
    () =>
      filtrarPorTexto(
        items,
        filtro,
        (p) =>
          `${p.dni ?? ""} ${p.nombreCompleto ?? ""} ${p.rol ?? ""} ${p.idPlanilla ?? ""}`,
      ),
    [items, filtro],
  );

  return (
    <section aria-label="Personal" className="flex flex-col gap-4">
      <p className="text-xs text-[var(--color-text-muted)]">
        Catálogo del personal cargado en el DWH
        (<span className="font-mono">Silver.Dim_Personal</span>). Las métricas de
        asertividad y ausencia provienen de planilla.
      </p>
      <CatalogoLayout
        page={page}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={(n) => {
          setPageSize(n);
          setPage(1);
        }}
        total={query.data?.total ?? 0}
        visible={filtrados.length}
        filtro={filtro}
        setFiltro={setFiltro}
        placeholder="Buscar por DNI, nombre, rol o planilla…"
        onRefresh={() => query.refetch()}
        isFetching={query.isFetching}
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
      >
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">DNI</th>
              <th className="px-3 py-2 font-medium">Nombre completo</th>
              <th className="px-3 py-2 font-medium">Rol</th>
              <th className="px-3 py-2 font-medium">Sexo</th>
              <th className="px-3 py-2 font-medium">Planilla</th>
              <th className="px-3 py-2 font-medium">Asertividad</th>
              <th className="px-3 py-2 font-medium">Días de ausencia</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p, i) => (
              <tr
                key={`${p.dni}-${i}`}
                className="border-t border-[var(--color-border)] transition hover:bg-[var(--color-surface-2)]/60"
              >
                <td className="px-3 py-2 font-mono text-[13px]">{p.dni ?? "—"}</td>
                <td className="px-3 py-2 font-medium">
                  {p.nombreCompleto ?? "—"}
                </td>
                <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                  {p.rol ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                  {sexoLegible(p.sexo)}
                </td>
                <td className="px-3 py-2 font-mono text-[13px] text-[var(--color-text-muted)]">
                  {p.idPlanilla ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <BarraAsertividad valor={p.pctAsertividad} />
                </td>
                <td className="px-3 py-2">
                  <AusentismoBadge dias={p.diasAusentismo} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CatalogoLayout>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Subcomponentes compartidos                                                  */
/* -------------------------------------------------------------------------- */

interface CatalogoLayoutProps {
  children: React.ReactNode;
  page: number;
  pageSize: PageSize;
  onPage: (n: number) => void;
  onPageSize: (n: PageSize) => void;
  total: number;
  visible: number;
  filtro: string;
  setFiltro: (s: string) => void;
  placeholder: string;
  onRefresh: () => void;
  isFetching: boolean;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

function CatalogoLayout({
  children,
  page,
  pageSize,
  onPage,
  onPageSize,
  total,
  visible,
  filtro,
  setFiltro,
  placeholder,
  onRefresh,
  isFetching,
  isLoading,
  isError,
  error,
}: CatalogoLayoutProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const desde = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const hasta = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
          <span className="tabular-nums">
            {visible !== total && filtro
              ? `${formatNumber(visible)} visibles de ${formatNumber(total)}`
              : `${formatNumber(total)} registros`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            aria-label="Refrescar"
            className="gap-1.5"
          >
            <RefreshCw
              aria-hidden
              className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
            />
            Refrescar
          </Button>
        </div>
      </div>

      {isError ? (
        <ErrorBlock
          message={error instanceof Error ? error.message : "Error al cargar"}
          onRetry={onRefresh}
        />
      ) : isLoading ? (
        <TablaSkeleton />
      ) : visible === 0 ? (
        <EmptyBlock filtroActivo={filtro.length > 0} />
      ) : (
        <div className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
          {children}
        </div>
      )}

      {total > 0 ? (
        <nav
          aria-label="Paginación"
          className="flex flex-col items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3 text-xs sm:flex-row"
        >
          <p className="text-[var(--color-text-muted)] tabular-nums">
            {formatNumber(desde)}–{formatNumber(hasta)} de {formatNumber(total)}
          </p>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[var(--color-text-muted)]">
              Filas por página
              <select
                value={pageSize}
                onChange={(e) =>
                  onPageSize(Number(e.target.value) as PageSize)
                }
                className="bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
                aria-label="Filas por página"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                aria-label="Página anterior"
                className="h-8 w-8 p-0"
              >
                <ChevronLeft aria-hidden className="h-4 w-4" />
              </Button>
              <span className="min-w-[60px] text-center text-[var(--color-text-secondary)] tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                aria-label="Página siguiente"
                className="h-8 w-8 p-0"
              >
                <ChevronRight aria-hidden className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex min-h-[42px] items-center gap-2 px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
        active
          ? "border-b-2 border-[var(--color-primary)] text-[var(--color-text)]"
          : "border-b-2 border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function SubTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "min-h-[32px] rounded px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
        active
          ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]",
      )}
    >
      {children}
    </button>
  );
}

function EstadoActivoBadge({ activa }: { activa: boolean }) {
  return activa ? (
    <Badge variant="success" className="gap-1">
      <ShieldCheck aria-hidden className="h-3 w-3" />
      Activa
    </Badge>
  ) : (
    <Badge variant="default" className="gap-1 opacity-80">
      <XCircle aria-hidden className="h-3 w-3" />
      Inactiva
    </Badge>
  );
}

function sexoLegible(s: string | null): string {
  if (!s) return "—";
  const norm = s.trim().toUpperCase();
  if (norm.startsWith("F")) return "Femenino";
  if (norm.startsWith("M")) return "Masculino";
  return s;
}

function BarraAsertividad({ valor }: { valor: number | null }) {
  if (valor == null)
    return <span className="text-xs text-[var(--color-text-muted)]">—</span>;
  const pct = Math.max(0, Math.min(100, valor));
  const tono =
    pct >= 90
      ? "var(--color-success)"
      : pct >= 70
        ? "var(--color-warning)"
        : "var(--color-destructive)";
  return (
    <div className="flex items-center gap-2">
      <span
        className="min-w-[42px] text-right text-xs font-semibold tabular-nums"
        style={{ color: tono }}
      >
        {formatPercent(pct, 0)}
      </span>
      <div
        className="h-1.5 w-24 overflow-hidden rounded-full bg-[var(--color-surface-2)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Asertividad ${pct.toFixed(0)} por ciento`}
      >
        <div
          className="h-full"
          style={{ width: `${pct}%`, backgroundColor: tono }}
        />
      </div>
    </div>
  );
}

function AusentismoBadge({ dias }: { dias: number | null }) {
  if (dias == null)
    return <span className="text-xs text-[var(--color-text-muted)]">—</span>;
  if (dias === 0)
    return (
      <Badge variant="success" className="gap-1">
        0 días
      </Badge>
    );
  if (dias <= 5) return <Badge variant="default">{dias} días</Badge>;
  if (dias <= 15) return <Badge variant="warning">{dias} días</Badge>;
  return <Badge variant="destructive">{dias} días</Badge>;
}

function TablaSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-md" />
      ))}
    </div>
  );
}

function EmptyBlock({ filtroActivo }: { filtroActivo: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] py-12 text-center text-sm">
      <p className="font-medium text-[var(--color-text)]">
        {filtroActivo ? "Sin resultados para tu búsqueda" : "Sin registros"}
      </p>
      <p className="max-w-sm text-xs text-[var(--color-text-muted)]">
        {filtroActivo
          ? "Prueba con menos palabras o ampliando el filtro."
          : "Aún no hay datos cargados en este catálogo."}
      </p>
    </div>
  );
}

function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-md border border-[var(--color-destructive)]/40 bg-[color-mix(in_oklab,var(--color-destructive)_8%,transparent)] px-4 py-3 text-sm text-[var(--color-destructive)]"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRetry}
        className="w-fit gap-1.5"
      >
        <RefreshCw aria-hidden className="h-3.5 w-3.5" />
        Reintentar
      </Button>
    </div>
  );
}

function filtrarPorTexto<T>(
  items: T[],
  filtro: string,
  pluck: (t: T) => string,
): T[] {
  const q = filtro.trim().toLowerCase();
  if (q === "") return items;
  return items.filter((it) => pluck(it).toLowerCase().includes(q));
}
