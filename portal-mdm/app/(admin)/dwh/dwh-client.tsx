"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Crown,
  Database,
  Download,
  GitMerge,
  Keyboard,
  Layers,
  Network,
  Pin,
  RefreshCw,
  Rows,
  Search,
  ShieldAlert,
  Table as TableIcon,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/charts/kpi-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import {
  DwhLineageGraph,
  DwhLineageLegend,
  type DwhLineageGraphHandle,
} from "@/components/control-center/dwh-lineage-graph";
import { DwhFactList } from "@/components/control-center/dwh-fact-list";
import { DwhFactPanel } from "@/components/control-center/dwh-fact-panel";
import { DwhKeyboardHelp } from "@/components/control-center/dwh-keyboard-help";
import { DwhQuickSearch } from "@/components/control-center/dwh-quick-search";
import { DwhExplainStaleDialog } from "@/components/control-center/dwh-explain-stale-dialog";
import { DwhComparePanel } from "@/components/control-center/dwh-compare-panel";
import { DwhSavedViewsMenu } from "@/components/control-center/dwh-saved-views-menu";
import {
  DwhNodeContextMenu,
  type NodeMenuItem,
} from "@/components/control-center/dwh-node-context-menu";
import { useDwhExplorer } from "@/hooks/use-dwh";
import { usePinnedNodes } from "@/hooks/use-pinned-nodes";
import { useStatusFlash } from "@/hooks/use-status-flash";
import { useDwhKeyboardNav } from "@/hooks/use-dwh-keyboard-nav";
import {
  DWH_ALL_STATUSES,
  useDwhUrlState,
} from "./use-dwh-url-state";
import type { DwhEdge, DwhNode, TableStatus } from "@/lib/schemas/dwh";
import type { Tone } from "@/lib/status";
import { useRouter } from "next/navigation";
import {
  Copy,
  FileSearch,
  HelpCircle,
  PlayCircle,
  Pin as PinIcon,
  PinOff,
  ScanSearch,
  Split,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_TONE: Record<TableStatus, Tone> = {
  ok: "ok",
  warning: "warning",
  failed: "critical",
  stale: "neutral",
  unknown: "neutral",
};

const STATUS_LABEL: Record<TableStatus, string> = {
  ok: "OK",
  warning: "Advertencia",
  failed: "Falló",
  stale: "Stale",
  unknown: "Sin datos",
};

export function DwhExplorerClient() {
  const url = useDwhUrlState();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [impactOn, setImpactOn] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [quickSearchOpen, setQuickSearchOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const lineageHostRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const graphRef = useRef<DwhLineageGraphHandle | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } =
    useDwhExplorer({ autoRefresh });

  const pins = usePinnedNodes();
  const flashSet = useStatusFlash(data?.nodes);

  const selectedNode = useMemo(
    () => data?.nodes.find((n) => n.id === url.selectedId) ?? null,
    [data, url.selectedId],
  );

  const selectedFact = useMemo(() => {
    if (!selectedNode || !data) return null;
    if (selectedNode.layer !== "silver") return null;
    return data.facts.find((f) => f.tablaDestino === selectedNode.id) ?? null;
  }, [selectedNode, data]);

  // BFS recursivo en ambas direcciones desde el nodo seleccionado.
  const pathSet = useMemo(() => {
    if (!url.selectedId || !data) return new Set<string>();
    return computeConnectedPath(url.selectedId, data.edges);
  }, [url.selectedId, data]);

  // Critical-path automático: cadenas downstream desde TODOS los failed/warning.
  const criticalPathSet = useMemo(() => {
    if (!impactOn || !data) return new Set<string>();
    const sources = data.nodes
      .filter((n) => n.status === "failed" || n.status === "warning")
      .map((n) => n.id);
    if (sources.length === 0) return new Set<string>();
    return computeDownstreamPath(sources, data.edges);
  }, [impactOn, data]);

  const criticalSourceCount = useMemo(() => {
    if (!data) return 0;
    return data.nodes.filter(
      (n) => n.status === "failed" || n.status === "warning",
    ).length;
  }, [data]);

  // Conteo de matches del filtro + status.
  const matchCount = useMemo(() => {
    if (!data) return 0;
    const lower = url.q.trim().toLowerCase();
    return data.nodes.filter((n) => {
      if (!url.statuses.has(n.status)) return false;
      if (!lower) return true;
      return (
        n.label.toLowerCase().includes(lower) ||
        n.fullName.toLowerCase().includes(lower) ||
        n.facts.some((f) => f.toLowerCase().includes(lower))
      );
    }).length;
  }, [data, url.q, url.statuses]);

  // Segundo nodo en modo compare.
  const compareNode = useMemo(
    () => data?.nodes.find((n) => n.id === url.compareId) ?? null,
    [data, url.compareId],
  );

  // Keyboard nav — ↑/↓/←/→/Enter/Esc/`/`/?
  useDwhKeyboardNav({
    nodes: data?.nodes ?? [],
    selectedId: url.selectedId,
    onSelect: (id) => url.setSelectedId(id),
    searchInputRef,
    onToggleHelp: () => setHelpOpen((v) => !v),
    enabled: !isLoading && !quickSearchOpen && !explainOpen,
  });

  // ⌘K / Ctrl+K → abre quick search scoped a DWH.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuickSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Cuando seleccionas con teclado, asegúrate de que el nodo está en viewport.
  useEffect(() => {
    if (!url.selectedId) return;
    const t = requestAnimationFrame(() =>
      graphRef.current?.scrollToNode(url.selectedId!),
    );
    return () => cancelAnimationFrame(t);
  }, [url.selectedId]);

  // Cuenta de status para badge en los chips.
  const statusCounts = useMemo(() => {
    const counts: Record<TableStatus, number> = {
      ok: 0,
      warning: 0,
      failed: 0,
      stale: 0,
      unknown: 0,
    };
    if (!data) return counts;
    for (const n of data.nodes) counts[n.status]++;
    return counts;
  }, [data]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="DWH Explorer"
        description="Mapa visual del Data Warehouse: lineage Bronce → Silver → Gold, con métricas de carga de las últimas 24 horas."
        actions={
          <HeaderActions
            autoRefresh={autoRefresh}
            onToggleAutoRefresh={() => setAutoRefresh((v) => !v)}
            onRefresh={() => refetch()}
            isFetching={isFetching}
            lastUpdated={dataUpdatedAt}
            onExport={
              url.view === "lineage"
                ? () => exportLineagePng(lineageHostRef.current)
                : undefined
            }
          />
        }
      />

      <KpiStrip
        loading={isLoading}
        error={isError}
        totals={data?.totals ?? null}
      />

      <Toolbar
        view={url.view}
        onViewChange={url.setView}
        filter={url.q}
        onFilterChange={url.setQ}
        searchInputRef={searchInputRef}
        density={url.density}
        onDensityChange={url.setDensity}
        statuses={url.statuses}
        statusCounts={statusCounts}
        onToggleStatus={url.toggleStatus}
        onClearStatus={url.clearStatuses}
        hasFilters={url.hasFilters}
        onResetAll={url.resetAll}
        matchCount={matchCount}
        totalCount={data?.nodes.length ?? 0}
        impactOn={impactOn}
        criticalSourceCount={criticalSourceCount}
        onToggleImpact={() => setImpactOn((v) => !v)}
        pinnedCount={pins.pinned.size}
        onShowHelp={() => setHelpOpen(true)}
        onOpenQuickSearch={() => setQuickSearchOpen(true)}
        takeSnapshot={url.takeSnapshot}
        applySnapshot={url.applySnapshot}
      />

      {isLoading ? (
        <Skeleton className="h-[480px] rounded-md" />
      ) : isError || !data ? (
        <ErrorPanel
          message={
            error instanceof Error
              ? error.message
              : "No se pudo cargar el DWH."
          }
          onRetry={() => refetch()}
        />
      ) : data.nodes.length === 0 ? (
        <EmptyPanel />
      ) : (
        <div
          className={cn(
            "grid gap-4",
            selectedNode ? "lg:grid-cols-[1fr_360px]" : "grid-cols-1",
          )}
        >
          <div className="flex min-w-0 flex-col gap-3" ref={lineageHostRef}>
            {url.view === "lineage" ? (
              <>
                <DwhLineageGraph
                  ref={graphRef}
                  nodes={data.nodes}
                  edges={data.edges}
                  selectedId={url.selectedId}
                  compareId={url.compareId}
                  filter={url.q}
                  pathSet={pathSet}
                  criticalPathSet={criticalPathSet}
                  flashSet={flashSet}
                  pinnedSet={pins.pinned}
                  statusFilter={url.statuses}
                  collapsedLayers={url.collapsed}
                  density={url.density}
                  onSelect={(id) =>
                    url.setSelectedId(id === url.selectedId ? null : id)
                  }
                  onCompareClick={(id) => {
                    if (!url.selectedId || url.selectedId === id) return;
                    url.setCompareId(id === url.compareId ? null : id);
                  }}
                  onNodeContextMenu={(id, x, y) =>
                    setCtxMenu({ id, x, y })
                  }
                  onToggleCollapseLayer={url.toggleCollapsedLayer}
                />
                <DwhLineageLegend />
              </>
            ) : (
              <DwhFactList
                nodes={data.nodes}
                selectedId={url.selectedId}
                filter={url.q}
                onSelect={(id) =>
                  url.setSelectedId(id === url.selectedId ? null : id)
                }
              />
            )}
          </div>

          {selectedNode && compareNode ? (
            <DwhComparePanel
              key={`cmp-${selectedNode.id}-${compareNode.id}`}
              a={selectedNode}
              b={compareNode}
              onSwap={() => {
                // intercambia A ↔ B
                const a = url.selectedId;
                const b = url.compareId;
                url.setSelectedId(b ?? null);
                url.setCompareId(a ?? null);
              }}
              onClose={() => url.setCompareId(null)}
            />
          ) : selectedNode ? (
            <DwhFactPanel
              key={selectedNode.id}
              node={selectedNode}
              fact={selectedFact}
              onClose={() => url.setSelectedId(null)}
              pinned={pins.isPinned(selectedNode.id)}
              onTogglePin={() => pins.toggle(selectedNode.id)}
              onExplain={() => setExplainOpen(true)}
              onCompare={() => {
                // Hint visual: marcamos algo para que el usuario sepa qué hacer.
                toast({
                  title: "Modo comparar activado",
                  description:
                    "Haz Shift+click sobre otro nodo del grafo para fijar la segunda columna.",
                });
              }}
            />
          ) : null}
        </div>
      )}

      <DwhKeyboardHelp open={helpOpen} onOpenChange={setHelpOpen} />
      <DwhQuickSearch
        open={quickSearchOpen}
        onOpenChange={setQuickSearchOpen}
        nodes={data?.nodes ?? []}
        onSelect={(id) => url.setSelectedId(id)}
      />
      <DwhExplainStaleDialog
        open={explainOpen}
        onOpenChange={setExplainOpen}
        node={selectedNode}
        nodes={data?.nodes ?? []}
        edges={data?.edges ?? []}
      />
      {ctxMenu && data ? (
        <DwhNodeContextMenu
          open
          x={ctxMenu.x}
          y={ctxMenu.y}
          heading={
            data.nodes.find((n) => n.id === ctxMenu.id)?.fullName ?? ctxMenu.id
          }
          items={buildContextItems({
            nodeId: ctxMenu.id,
            nodes: data.nodes,
            isPinned: pins.isPinned(ctxMenu.id),
            onSelect: () => url.setSelectedId(ctxMenu.id),
            onTogglePin: () => pins.toggle(ctxMenu.id),
            onCompare: () => {
              if (!url.selectedId || url.selectedId === ctxMenu.id) {
                url.setSelectedId(ctxMenu.id);
              } else {
                url.setCompareId(ctxMenu.id);
              }
            },
            onExplain: () => {
              url.setSelectedId(ctxMenu.id);
              setExplainOpen(true);
            },
            onLaunch: (fact) =>
              router.push(`/etl-monitor/lanzar?fact=${encodeURIComponent(fact)}`),
            onBitacora: () =>
              router.push(`/bitacora?tabla=${encodeURIComponent(ctxMenu.id)}`),
            onCopy: () => {
              const n = data.nodes.find((x) => x.id === ctxMenu.id);
              if (!n) return;
              navigator.clipboard?.writeText(n.fullName);
              toast({
                title: "Copiado",
                description: n.fullName,
              });
            },
          })}
          onClose={() => setCtxMenu(null)}
        />
      ) : null}
    </div>
  );
}

/* ── Context menu items factory ──────────────────────────────────────────── */

interface ContextItemsParams {
  nodeId: string;
  nodes: DwhNode[];
  isPinned: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onCompare: () => void;
  onExplain: () => void;
  onLaunch: (fact: string) => void;
  onBitacora: () => void;
  onCopy: () => void;
}

function buildContextItems(p: ContextItemsParams): NodeMenuItem[] {
  const n = p.nodes.find((x) => x.id === p.nodeId);
  const fact = n?.facts[0] ?? null;
  return [
    {
      id: "open",
      label: "Abrir panel",
      icon: <ScanSearch className="h-3.5 w-3.5" />,
      shortcut: "Enter",
      onSelect: p.onSelect,
    },
    {
      id: "compare",
      label: "Comparar con…",
      icon: <Split className="h-3.5 w-3.5" />,
      shortcut: "Shift+click",
      onSelect: p.onCompare,
    },
    {
      id: "explain",
      label: "¿Por qué está así?",
      icon: <HelpCircle className="h-3.5 w-3.5" />,
      onSelect: p.onExplain,
    },
    { id: "_separator", label: "", onSelect: () => {} },
    {
      id: "launch",
      label: "Re-procesar",
      icon: <PlayCircle className="h-3.5 w-3.5" />,
      disabled: !fact,
      onSelect: () => fact && p.onLaunch(fact),
    },
    {
      id: "bitacora",
      label: "Ver bitácora",
      icon: <FileSearch className="h-3.5 w-3.5" />,
      onSelect: p.onBitacora,
    },
    {
      id: "pin",
      label: p.isPinned ? "Desfijar" : "Fijar nodo",
      icon: p.isPinned ? (
        <PinOff className="h-3.5 w-3.5" />
      ) : (
        <PinIcon className="h-3.5 w-3.5" />
      ),
      onSelect: p.onTogglePin,
    },
    { id: "_separator", label: "", onSelect: () => {} },
    {
      id: "copy",
      label: "Copiar nombre",
      icon: <Copy className="h-3.5 w-3.5" />,
      onSelect: p.onCopy,
    },
  ];
}

/* ── BFS del path ────────────────────────────────────────────────────────── */

/**
 * Critical-path automático: BFS downstream desde TODOS los nodos en estado
 * crítico (failed o warning). Devuelve el set de nodos impactados — incluye
 * a los propios sources. Si no hay sources, devuelve un set vacío.
 */
function computeDownstreamPath(rootIds: string[], edges: DwhEdge[]): Set<string> {
  if (rootIds.length === 0) return new Set();
  const adjOut = new Map<string, string[]>();
  for (const e of edges) {
    (adjOut.get(e.from) ?? adjOut.set(e.from, []).get(e.from)!).push(e.to);
  }
  const set = new Set<string>(rootIds);
  const queue: string[] = [...rootIds];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const next of adjOut.get(cur) ?? []) {
      if (!set.has(next)) {
        set.add(next);
        queue.push(next);
      }
    }
  }
  return set;
}

function computeConnectedPath(rootId: string, edges: DwhEdge[]): Set<string> {
  const adjOut = new Map<string, string[]>();
  const adjIn = new Map<string, string[]>();
  for (const e of edges) {
    (adjOut.get(e.from) ?? adjOut.set(e.from, []).get(e.from)!).push(e.to);
    (adjIn.get(e.to) ?? adjIn.set(e.to, []).get(e.to)!).push(e.from);
  }

  const set = new Set<string>([rootId]);

  // Downstream
  const downQ: string[] = [rootId];
  while (downQ.length) {
    const cur = downQ.shift()!;
    for (const next of adjOut.get(cur) ?? []) {
      if (!set.has(next)) {
        set.add(next);
        downQ.push(next);
      }
    }
  }
  // Upstream
  const upQ: string[] = [rootId];
  while (upQ.length) {
    const cur = upQ.shift()!;
    for (const prev of adjIn.get(cur) ?? []) {
      if (!set.has(prev)) {
        set.add(prev);
        upQ.push(prev);
      }
    }
  }
  return set;
}

/* ── Header actions ──────────────────────────────────────────────────────── */

interface HeaderActionsProps {
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onRefresh: () => void;
  isFetching: boolean;
  lastUpdated: number;
  onExport?: () => void;
}

function HeaderActions({
  autoRefresh,
  onToggleAutoRefresh,
  onRefresh,
  isFetching,
  lastUpdated,
  onExport,
}: HeaderActionsProps) {
  const freshness = useFreshnessLabel(lastUpdated);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="text-xs text-[var(--color-text-muted)] tabular-nums"
        aria-live="polite"
      >
        Actualizado {freshness}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={autoRefresh}
        aria-label="Auto-refresh cada 60 segundos"
        onClick={onToggleAutoRefresh}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
          autoRefresh
            ? "border-[color-mix(in_oklab,var(--color-primary)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-primary)_10%,transparent)] text-[var(--color-primary)]"
            : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            autoRefresh ? "bg-[var(--color-primary)]" : "bg-[var(--color-text-muted)]",
          )}
        />
        Auto {autoRefresh ? "ON" : "OFF"}
      </button>
      {onExport ? (
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          aria-label="Exportar lineage como PNG"
        >
          <Download aria-hidden className="h-3.5 w-3.5" />
          PNG
        </Button>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        aria-label="Refrescar mapa del DWH"
      >
        <RefreshCw
          aria-hidden
          className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
        />
        Refrescar
      </Button>
    </div>
  );
}

function useFreshnessLabel(updatedAt: number): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  if (!updatedAt) return "—";
  const diffSec = Math.max(0, Math.floor((now - updatedAt) / 1000));
  if (diffSec < 5) return "ahora";
  if (diffSec < 60) return `hace ${diffSec}s`;
  if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)}m`;
  return `hace ${Math.floor(diffSec / 3600)}h`;
}

/* ── KPI strip ───────────────────────────────────────────────────────────── */

interface KpiStripProps {
  loading: boolean;
  error: boolean;
  totals: { facts: number; bronce: number; silver: number; gold: number } | null;
}

function KpiStrip({ loading, error, totals }: KpiStripProps) {
  if (loading) {
    return (
      <section
        aria-label="Totales del DWH"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-md" />
        ))}
      </section>
    );
  }
  if (error || !totals) {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 rounded-md border border-[color-mix(in_oklab,var(--color-destructive)_40%,transparent)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-destructive)]"
      >
        <AlertTriangle aria-hidden className="h-4 w-4" />
        No se pudo cargar el resumen del DWH.
      </div>
    );
  }
  return (
    <section
      aria-label="Totales del DWH"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
      <KpiCard label="Facts ETL" value={totals.facts} icon={GitMerge} tone="default" />
      <KpiCard label="Tablas Bronce" value={totals.bronce} icon={Database} tone="info" />
      <KpiCard label="Tablas Silver" value={totals.silver} icon={Layers} tone="success" />
      <KpiCard label="Marts Gold" value={totals.gold} icon={Crown} tone="warning" />
    </section>
  );
}

/* ── Toolbar ─────────────────────────────────────────────────────────────── */

interface ToolbarProps {
  view: "lineage" | "table";
  onViewChange: (v: "lineage" | "table") => void;
  filter: string;
  onFilterChange: (v: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  density: "comfortable" | "compact";
  onDensityChange: (d: "comfortable" | "compact") => void;
  statuses: Set<TableStatus>;
  statusCounts: Record<TableStatus, number>;
  onToggleStatus: (s: TableStatus) => void;
  onClearStatus: () => void;
  hasFilters: boolean;
  onResetAll: () => void;
  matchCount: number;
  totalCount: number;
  impactOn: boolean;
  criticalSourceCount: number;
  onToggleImpact: () => void;
  pinnedCount: number;
  onShowHelp: () => void;
  onOpenQuickSearch: () => void;
  takeSnapshot: () => import("./use-dwh-url-state").DwhUrlSnapshot;
  applySnapshot: (s: import("./use-dwh-url-state").DwhUrlSnapshot) => void;
}

/* eslint-disable react-hooks/refs */
function Toolbar(p: ToolbarProps) {
  const allStatusesActive = p.statuses.size === DWH_ALL_STATUSES.length;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <Input
            ref={p.searchInputRef}
            aria-label="Buscar tabla o fact"
            placeholder="Buscar tabla, fact o mart… (atajo /)"
            className="pl-9"
            value={p.filter}
            onChange={(e) => p.onFilterChange(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-[var(--color-text-muted)]">
            <span className="font-medium text-[var(--color-text)]">{p.matchCount}</span>
            <span> / {p.totalCount} tablas</span>
          </span>

          <button
            type="button"
            aria-pressed={p.impactOn}
            onClick={p.onToggleImpact}
            disabled={p.criticalSourceCount === 0}
            title={
              p.criticalSourceCount === 0
                ? "No hay tablas en estado warning/failed"
                : `${p.criticalSourceCount} tabla(s) crítica(s) — pinta downstream`
            }
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
              "disabled:cursor-not-allowed disabled:opacity-40",
              p.impactOn
                ? "border-[color-mix(in_oklab,var(--color-destructive)_45%,transparent)] bg-[color-mix(in_oklab,var(--color-destructive)_10%,transparent)] text-[var(--color-destructive)]"
                : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]",
            )}
          >
            <ShieldAlert aria-hidden className="h-3.5 w-3.5" />
            Impacto
            {p.criticalSourceCount > 0 ? (
              <span
                className={cn(
                  "ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums",
                  p.impactOn
                    ? "bg-[var(--color-destructive)] text-[var(--color-primary-foreground)]"
                    : "bg-[color-mix(in_oklab,var(--color-destructive)_18%,transparent)] text-[var(--color-destructive)]",
                )}
              >
                {p.criticalSourceCount}
              </span>
            ) : null}
          </button>

          {p.pinnedCount > 0 ? (
            <span
              aria-label={`${p.pinnedCount} nodos fijados`}
              title={`${p.pinnedCount} nodos fijados`}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[color-mix(in_oklab,var(--color-primary)_40%,transparent)] bg-[color-mix(in_oklab,var(--color-primary)_8%,transparent)] px-2 text-xs text-[var(--color-primary)]"
            >
              <Pin aria-hidden className="h-3.5 w-3.5" />
              <span className="tabular-nums">{p.pinnedCount}</span>
            </span>
          ) : null}

          <button
            type="button"
            onClick={p.onOpenQuickSearch}
            aria-label="Abrir búsqueda rápida"
            title="Búsqueda rápida (⌘K / Ctrl+K)"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 text-xs text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            <Search aria-hidden className="h-3.5 w-3.5" />
            <kbd className="font-mono text-[10px]">⌘K</kbd>
          </button>

          <DwhSavedViewsMenu
            takeSnapshot={p.takeSnapshot}
            applySnapshot={p.applySnapshot}
          />

          <button
            type="button"
            onClick={p.onShowHelp}
            aria-label="Ver atajos de teclado"
            title="Ver atajos de teclado (?)"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] transition hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            <Keyboard aria-hidden className="h-3.5 w-3.5" />
          </button>

          <div
            role="group"
            aria-label="Densidad"
            className="flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)]"
          >
            <ViewBtn
              active={p.density === "comfortable"}
              onClick={() => p.onDensityChange("comfortable")}
              icon={<Rows aria-hidden className="h-3.5 w-3.5" />}
              label="Cómoda"
            />
            <ViewBtn
              active={p.density === "compact"}
              onClick={() => p.onDensityChange("compact")}
              icon={<Rows aria-hidden className="h-3 w-3" />}
              label="Compacta"
            />
          </div>

          <div
            role="group"
            aria-label="Tipo de vista"
            className="flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)]"
          >
            <ViewBtn
              active={p.view === "lineage"}
              onClick={() => p.onViewChange("lineage")}
              icon={<Network aria-hidden className="h-3.5 w-3.5" />}
              label="Lineage"
            />
            <ViewBtn
              active={p.view === "table"}
              onClick={() => p.onViewChange("table")}
              icon={<TableIcon aria-hidden className="h-3.5 w-3.5" />}
              label="Tabla"
            />
          </div>
        </div>
      </div>

      <div
        role="group"
        aria-label="Filtrar por estado"
        className="flex flex-wrap items-center gap-2"
      >
        {DWH_ALL_STATUSES.map((s) => {
          const active = p.statuses.has(s);
          const count = p.statusCounts[s];
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => p.onToggleStatus(s)}
              className={cn(
                "transition-opacity",
                allStatusesActive ? "opacity-100" : active ? "opacity-100" : "opacity-50",
              )}
            >
              <StatusBadge
                tone={STATUS_TONE[s]}
                label={`${STATUS_LABEL[s]} · ${count}`}
                variant="chip"
                size="sm"
              />
            </button>
          );
        })}
        {!allStatusesActive ? (
          <button
            type="button"
            onClick={p.onClearStatus}
            className="text-xs text-[var(--color-text-muted)] underline-offset-2 hover:text-[var(--color-text)] hover:underline"
          >
            Mostrar todos
          </button>
        ) : null}
        {p.hasFilters ? (
          <button
            type="button"
            onClick={p.onResetAll}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-0.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <X aria-hidden className="h-3 w-3" />
            Limpiar filtros
          </button>
        ) : null}
      </div>
    </div>
  );
}
/* eslint-enable react-hooks/refs */

function ViewBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs transition",
        active
          ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/* ── Error / Empty ───────────────────────────────────────────────────────── */

function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--color-destructive)_40%,transparent)] bg-[var(--color-surface-2)] p-4 text-sm"
    >
      <div className="flex items-center gap-2 text-[var(--color-destructive)]">
        <AlertTriangle aria-hidden className="h-4 w-4" />
        <span className="font-medium">No se pudo cargar el mapa del DWH</span>
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw aria-hidden className="h-3.5 w-3.5" />
        Reintentar
      </Button>
    </div>
  );
}

function EmptyPanel() {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center"
    >
      <span
        aria-hidden
        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
      >
        <Network className="h-7 w-7" />
      </span>
      <p className="text-base font-semibold text-[var(--color-text)]">
        Sin facts registrados
      </p>
      <p className="max-w-md text-sm text-[var(--color-text-muted)]">
        El catálogo del pipeline está vacío. Cuando el backend exponga facts en
        <span className="mx-1 font-mono">/api/v1/etl/facts</span>
        aparecerán aquí.
      </p>
    </div>
  );
}

/* ── Export PNG ──────────────────────────────────────────────────────────── */

function exportLineagePng(host: HTMLElement | null) {
  if (!host) return;
  const svg = host.querySelector("svg");
  if (!svg) return;

  // Clonamos para no mutar el SVG en pantalla.
  const clone = svg.cloneNode(true) as SVGSVGElement;
  // Forzamos fondo opaco usando el surface token resuelto en runtime.
  const styles = getComputedStyle(document.documentElement);
  const bg = styles.getPropertyValue("--color-surface").trim() || "#0f172a";
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("style", `background:${bg}`);

  const xml = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([xml], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const vbW = Number(clone.getAttribute("width")) || svg.clientWidth || 1200;
    const vbH = Number(clone.getAttribute("height")) || svg.clientHeight || 800;
    const scale = 2; // 2x para retina-friendly
    const canvas = document.createElement("canvas");
    canvas.width = vbW * scale;
    canvas.height = vbH * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return;
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((png) => {
      if (!png) return;
      const pngUrl = URL.createObjectURL(png);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `dwh-lineage-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(pngUrl);
    }, "image/png");
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

// Re-export type para mantener compatibilidad si alguien importaba de aquí.
export type { DwhNode };
