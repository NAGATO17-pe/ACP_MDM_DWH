"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minus,
  Pin,
  Plus,
  RotateCcw,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDateTime, formatNumber } from "@/lib/format";
import { DwhMinimap } from "@/components/control-center/dwh-minimap";
import type { DwhEdge, DwhNode, TableStatus } from "@/lib/schemas/dwh";

type LayerName = "bronce" | "silver" | "gold";

interface DwhLineageGraphProps {
  nodes: DwhNode[];
  edges: DwhEdge[];
  selectedId: string | null;
  /** Segundo nodo en modo compare — recibe anillo secundario. */
  compareId?: string | null;
  filter: string;
  /** BFS desde el nodo seleccionado (upstream+downstream). Vacío si no hay selección. */
  pathSet: Set<string>;
  /** Nodos en el critical path automático (downstream desde failed/warning). */
  criticalPathSet: Set<string>;
  /** Nodos cuyo status acaba de empeorar — flashea brevemente. */
  flashSet: Set<string>;
  /** Nodos pinneados por el usuario — anillo permanente. */
  pinnedSet: ReadonlySet<string>;
  /** Status visibles. Los nodos con status fuera del set se atenúan. */
  statusFilter: Set<TableStatus>;
  /** Capas colapsadas — renderizan barra delgada en vez de cards. */
  collapsedLayers?: ReadonlySet<LayerName>;
  density: "comfortable" | "compact";
  onSelect: (id: string) => void;
  /** Click derecho sobre un nodo — el padre decide qué hacer. Coords en `client*`. */
  onNodeContextMenu?: (id: string, x: number, y: number) => void;
  /** Shift+click sobre un nodo — para activar modo compare. */
  onCompareClick?: (id: string) => void;
  /** Toggle del colapso de una capa desde el header. */
  onToggleCollapseLayer?: (layer: LayerName) => void;
}

export interface DwhLineageGraphHandle {
  /** Aciona "centrar la vista en el nodo X". Se usa al navegar con teclado. */
  scrollToNode: (id: string) => void;
}

/* -------------------------------------------------------------------------- */
/* Geometry — depende de la densidad                                          */
/* -------------------------------------------------------------------------- */

const GEOM = {
  comfortable: {
    NODE_W: 200,
    NODE_H: 56,
    NODE_GAP_Y: 14,
    COLUMN_GAP_X: 96,
    LABEL_MAX: 22,
  },
  compact: {
    NODE_W: 168,
    NODE_H: 40,
    NODE_GAP_Y: 8,
    COLUMN_GAP_X: 72,
    LABEL_MAX: 18,
  },
} as const;

const COLUMN_PAD_TOP = 56;
const SVG_PAD_X = 24;
const SVG_PAD_BOTTOM = 24;

const LAYER_ORDER = ["bronce", "silver", "gold"] as const;
type Layer = (typeof LAYER_ORDER)[number];

const LAYER_LABEL: Record<Layer, string> = {
  bronce: "Bronce",
  silver: "Silver",
  gold: "Gold",
};

const LAYER_HELP: Record<Layer, string> = {
  bronce: "Raw ingestado desde Excel/SAP",
  silver: "Facts canónicos validados",
  gold: "Marts agregados para BI",
};

const STATUS_TOKEN: Record<TableStatus, { dot: string; ring: string }> = {
  ok: {
    dot: "var(--color-success)",
    ring: "color-mix(in oklab, var(--color-success) 60%, transparent)",
  },
  warning: {
    dot: "var(--color-warning)",
    ring: "color-mix(in oklab, var(--color-warning) 60%, transparent)",
  },
  failed: {
    dot: "var(--color-destructive)",
    ring: "color-mix(in oklab, var(--color-destructive) 60%, transparent)",
  },
  stale: {
    dot: "var(--color-text-muted)",
    ring: "var(--color-border)",
  },
  unknown: {
    dot: "var(--color-text-muted)",
    ring: "var(--color-border)",
  },
};

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.2;

const EMPTY_LAYERS: ReadonlySet<LayerName> = new Set();

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export const DwhLineageGraph = forwardRef<DwhLineageGraphHandle, DwhLineageGraphProps>(
  function DwhLineageGraph(
    {
      nodes,
      edges,
      selectedId,
      compareId,
      filter,
      pathSet,
      criticalPathSet,
      flashSet,
      pinnedSet,
      statusFilter,
      collapsedLayers,
      density,
      onSelect,
      onNodeContextMenu,
      onCompareClick,
      onToggleCollapseLayer,
    },
    ref,
  ) {
    const geom = GEOM[density];
    const collapsed = collapsedLayers ?? EMPTY_LAYERS;
    const layout = useMemo(
      () => computeLayout(nodes, geom, collapsed),
      [nodes, geom, collapsed],
    );
    const lowerFilter = filter.trim().toLowerCase();

    const matchesFilter = (n: DwhNode): boolean =>
      !lowerFilter ||
      n.label.toLowerCase().includes(lowerFilter) ||
      n.fullName.toLowerCase().includes(lowerFilter) ||
      n.facts.some((f) => f.toLowerCase().includes(lowerFilter));

    const passesStatus = (n: DwhNode): boolean => statusFilter.has(n.status);

    const isDimmed = (id: string): boolean => {
      // Si hay critical-path activo, los que NO están en él se atenúan.
      if (criticalPathSet.size > 0 && !criticalPathSet.has(id)) return true;
      if (selectedId && !pathSet.has(id)) return true;
      const n = nodes.find((x) => x.id === id);
      if (!n) return true;
      if (!passesStatus(n)) return true;
      if (lowerFilter && !matchesFilter(n)) return true;
      return false;
    };

    const isHighlighted = (id: string): boolean =>
      !!lowerFilter && nodeMatchesFilter(nodes, id, lowerFilter);

    /* ---------- Zoom + pan state ---------- */
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(
      null,
    );
    const scrollHostRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }, [nodes.length, density, collapsed]);

    // Imperativo: scroll-into-view del nodo (para keyboard nav).
    useImperativeHandle(
      ref,
      () => ({
        scrollToNode: (id: string) => {
          const host = scrollHostRef.current;
          const pos = layout.positions.get(id);
          if (!host || !pos) return;
          const cx = (pos.x + geom.NODE_W / 2) * zoom + pan.x;
          const cy = (pos.y + geom.NODE_H / 2) * zoom + pan.y;
          const targetLeft = cx - host.clientWidth / 2;
          const targetTop = cy - host.clientHeight / 2;
          // Solo desplazamos si el nodo está fuera del viewport visible.
          const visibleLeft = host.scrollLeft;
          const visibleRight = visibleLeft + host.clientWidth;
          const visibleTop = host.scrollTop;
          const visibleBottom = visibleTop + host.clientHeight;
          const nodeLeft = cx - geom.NODE_W * zoom * 0.5;
          const nodeRight = cx + geom.NODE_W * zoom * 0.5;
          const nodeTop = cy - geom.NODE_H * zoom * 0.5;
          const nodeBottom = cy + geom.NODE_H * zoom * 0.5;
          const xOutside = nodeRight > visibleRight || nodeLeft < visibleLeft;
          const yOutside = nodeBottom > visibleBottom || nodeTop < visibleTop;
          if (!xOutside && !yOutside) return;
          host.scrollTo({
            left: Math.max(0, targetLeft),
            top: Math.max(0, targetTop),
            behavior: "smooth",
          });
        },
      }),
      [layout, geom, zoom, pan],
    );

    const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
      if (e.button !== 0) return;
      const target = e.target as Element;
      if (target.closest("[data-dwh-node]")) return;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      dragRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    };
    const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
      if (!dragRef.current) return;
      setPan({
        x: dragRef.current.panX + (e.clientX - dragRef.current.x),
        y: dragRef.current.panY + (e.clientY - dragRef.current.y),
      });
    };
    const onPointerUp = () => {
      dragRef.current = null;
    };

    const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
    const zoomOut = () =>
      setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));
    const resetView = () => {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    };

    const { width, height } = layout.dimensions;

    // Lookup rápido para el cálculo de edge labels.
    const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

    return (
      <TooltipProvider delayDuration={250} disableHoverableContent>
        <div
          role="figure"
          aria-label="Mapa de lineage Bronce, Silver y Gold del Data Warehouse"
          className="bg-surface relative overflow-hidden rounded-lg border border-[var(--color-border)]"
        >
          <ViewportControls
            zoom={zoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={resetView}
          />

          <div
            ref={scrollHostRef}
            className="overflow-auto"
            style={{ maxHeight: "min(78vh, 720px)" }}
          >
            <svg
              viewBox={`0 0 ${width} ${height}`}
              width={width * zoom}
              height={height * zoom}
              style={{ minWidth: width * zoom, height: height * zoom }}
              className={cn(
                "block touch-none select-none",
                // eslint-disable-next-line react-hooks/refs
                dragRef.current ? "cursor-grabbing" : "cursor-grab",
              )}
              role="img"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <defs>
                <marker
                  id="dwh-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path
                    d="M 0 0 L 10 5 L 0 10 z"
                    fill="var(--color-text-muted)"
                    opacity="0.7"
                  />
                </marker>
                <marker
                  id="dwh-arrow-active"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-primary)" />
                </marker>
                <marker
                  id="dwh-arrow-critical"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-destructive)" />
                </marker>
                <filter id="dwh-pin-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <g transform={`translate(${pan.x} ${pan.y})`}>
                {/* Layer headers + toggle de colapso */}
                {LAYER_ORDER.map((layer) => {
                  const col = layout.columns[layer];
                  const cx = col.left + col.width / 2;
                  const isCollapsed = col.collapsed;
                  return (
                    <g key={`hdr-${layer}`}>
                      <text
                        x={cx}
                        y={22}
                        textAnchor="middle"
                        style={{
                          font: "600 13px var(--font-inter, sans-serif)",
                          writingMode: isCollapsed ? "vertical-rl" : undefined,
                        } as React.CSSProperties}
                        className="fill-[var(--color-text)]"
                      >
                        {LAYER_LABEL[layer]}
                      </text>
                      {!isCollapsed ? (
                        <text
                          x={cx}
                          y={38}
                          textAnchor="middle"
                          style={{ font: "400 10px var(--font-inter, sans-serif)" }}
                          className="fill-[var(--color-text-muted)]"
                        >
                          {LAYER_HELP[layer]}
                        </text>
                      ) : null}
                      {onToggleCollapseLayer && col.count > 0 ? (
                        <g
                          role="button"
                          tabIndex={0}
                          aria-label={
                            isCollapsed
                              ? `Expandir capa ${LAYER_LABEL[layer]}`
                              : `Colapsar capa ${LAYER_LABEL[layer]}`
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleCollapseLayer(layer);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onToggleCollapseLayer(layer);
                            }
                          }}
                          className="cursor-pointer outline-none"
                          transform={`translate(${col.left + col.width - 14} 8)`}
                        >
                          <circle r={7} fill="var(--color-surface-2)" stroke="var(--color-border)" />
                          {isCollapsed ? (
                            <ChevronRight
                              x={-4}
                              y={-4}
                              width={8}
                              height={8}
                              stroke="var(--color-text-secondary)"
                              strokeWidth={2}
                              fill="none"
                            />
                          ) : (
                            <ChevronLeft
                              x={-4}
                              y={-4}
                              width={8}
                              height={8}
                              stroke="var(--color-text-secondary)"
                              strokeWidth={2}
                              fill="none"
                            />
                          )}
                        </g>
                      ) : null}
                    </g>
                  );
                })}

                {/* Edges */}
                <g aria-hidden="true">
                  {edges.map((e, idx) => {
                    const a = layout.positions.get(e.from);
                    const b = layout.positions.get(e.to);
                    if (!a || !b) return null;
                    const colA = layout.columns[a.layer];
                    const colB = layout.columns[b.layer];
                    const x1 = colA.left + colA.width;
                    const y1 = colA.collapsed
                      ? COLUMN_PAD_TOP + (colA.count * (geom.NODE_H + geom.NODE_GAP_Y)) / 2
                      : a.y + geom.NODE_H / 2;
                    const x2 = colB.left;
                    const y2 = colB.collapsed
                      ? COLUMN_PAD_TOP + (colB.count * (geom.NODE_H + geom.NODE_GAP_Y)) / 2
                      : b.y + geom.NODE_H / 2;
                    const midX = (x1 + x2) / 2;
                    const midY = (y1 + y2) / 2;
                    const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
                    const inPath =
                      selectedId && pathSet.has(e.from) && pathSet.has(e.to);
                    const isCritical =
                      criticalPathSet.size > 0 &&
                      criticalPathSet.has(e.from) &&
                      criticalPathSet.has(e.to);
                    const dim = isDimmed(e.from) || isDimmed(e.to);
                    const stroke = isCritical
                      ? "var(--color-destructive)"
                      : inPath
                        ? "var(--color-primary)"
                        : "var(--color-text-muted)";
                    const marker = isCritical
                      ? "url(#dwh-arrow-critical)"
                      : inPath
                        ? "url(#dwh-arrow-active)"
                        : "url(#dwh-arrow)";
                    // Etiqueta de throughput sólo en edges de flujo (no dependencia)
                    // que tienen actividad o rechazos.
                    const src = nodeById.get(e.from);
                    const showLabel =
                      e.kind === "flow" &&
                      !dim &&
                      src != null &&
                      (src.rowsLast24h > 0 || src.rejectedLast24h > 0);
                    return (
                      <g key={`edge-${idx}`}>
                        <path
                          d={d}
                          fill="none"
                          stroke={stroke}
                          strokeWidth={isCritical ? 2 : inPath ? 1.8 : 1.1}
                          strokeDasharray={
                            e.kind === "dependency" ? "4 4" : undefined
                          }
                          opacity={
                            dim ? 0.12 : isCritical ? 0.95 : inPath ? 0.9 : 0.4
                          }
                          markerEnd={marker}
                        />
                        {showLabel && src ? (
                          <EdgeLabel
                            x={midX}
                            y={midY}
                            rows={src.rowsLast24h}
                            rejected={src.rejectedLast24h}
                            tone={isCritical ? "critical" : inPath ? "active" : "muted"}
                          />
                        ) : null}
                      </g>
                    );
                  })}
                </g>

                {/* Barras de capa colapsada */}
                <g>
                  {LAYER_ORDER.map((layer) => {
                    const col = layout.columns[layer];
                    if (!col.collapsed || col.count === 0) return null;
                    const barY = COLUMN_PAD_TOP;
                    const barH = col.count * (geom.NODE_H + geom.NODE_GAP_Y) - geom.NODE_GAP_Y;
                    return (
                      <g
                        key={`bar-${layer}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Capa ${LAYER_LABEL[layer]} colapsada con ${col.count} tablas — click para expandir`}
                        onClick={() => onToggleCollapseLayer?.(layer)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onToggleCollapseLayer?.(layer);
                          }
                        }}
                        className="cursor-pointer outline-none"
                      >
                        <rect
                          x={col.left}
                          y={barY}
                          width={col.width}
                          height={barH}
                          rx={6}
                          fill="var(--color-surface-2)"
                          stroke="var(--color-border)"
                        />
                        <text
                          x={col.left + col.width / 2}
                          y={barY + barH / 2}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          style={{
                            font: "600 11px var(--font-jetbrains-mono, monospace)",
                            writingMode: "vertical-rl",
                          } as React.CSSProperties}
                          className="fill-[var(--color-text-secondary)]"
                        >
                          {col.count}
                        </text>
                      </g>
                    );
                  })}
                </g>

                {/* Nodes (solo capas no colapsadas) */}
                <g>
                  {nodes.map((n) => {
                    const pos = layout.positions.get(n.id);
                    if (!pos) return null;
                    if (layout.columns[pos.layer].collapsed) return null;
                    return (
                      <DwhNodeRect
                        key={n.id}
                        node={n}
                        x={pos.x}
                        y={pos.y}
                        geom={geom}
                        selected={selectedId === n.id}
                        compare={compareId === n.id}
                        dim={isDimmed(n.id)}
                        highlighted={isHighlighted(n.id)}
                        pinned={pinnedSet.has(n.id)}
                        flashing={flashSet.has(n.id)}
                        critical={criticalPathSet.has(n.id)}
                        onSelect={onSelect}
                        onContextMenu={onNodeContextMenu}
                        onCompareClick={onCompareClick}
                      />
                    );
                  })}
                </g>
              </g>
            </svg>
          </div>

          <DwhMinimap
            scrollContainerRef={scrollHostRef}
            worldWidth={width}
            worldHeight={height}
            zoom={zoom}
            nodes={nodes}
            positions={layout.positions}
            nodeWidth={geom.NODE_W}
            nodeHeight={geom.NODE_H}
          />
        </div>
      </TooltipProvider>
    );
  },
);

/* -------------------------------------------------------------------------- */
/* Edge label                                                                  */
/* -------------------------------------------------------------------------- */

function EdgeLabel({
  x,
  y,
  rows,
  rejected,
  tone,
}: {
  x: number;
  y: number;
  rows: number;
  rejected: number;
  tone: "muted" | "active" | "critical";
}) {
  const text = rows > 0 ? `${formatRows(rows)} · 24h` : "0 · 24h";
  const color =
    tone === "critical"
      ? "var(--color-destructive)"
      : tone === "active"
        ? "var(--color-primary)"
        : "var(--color-text-secondary)";
  // Padding visual sobre la línea: rect translúcido detrás del texto.
  const padX = 4;
  const padY = 1.5;
  // Aproximación de ancho: 6.2px por carácter para 10px font.
  const approxW = text.length * 6.2 + padX * 2 + (rejected > 0 ? 12 : 0);
  return (
    <g aria-hidden>
      <rect
        x={x - approxW / 2}
        y={y - 8}
        width={approxW}
        height={14}
        rx={3}
        fill="var(--color-surface)"
        opacity={0.92}
      />
      <rect
        x={x - approxW / 2}
        y={y - 8}
        width={approxW}
        height={14}
        rx={3}
        fill="none"
        stroke={color}
        strokeOpacity={0.25}
      />
      {rejected > 0 ? (
        <>
          <text
            x={x - approxW / 2 + padX + 1}
            y={y + padY + 1}
            style={{ font: "600 9px var(--font-inter, sans-serif)" }}
            fill="var(--color-warning)"
          >
            ⚠
          </text>
          <text
            x={x - approxW / 2 + padX + 13}
            y={y + padY + 1}
            style={{ font: "500 9.5px var(--font-jetbrains-mono, monospace)" }}
            fill={color}
          >
            {text}
          </text>
        </>
      ) : (
        <text
          x={x}
          y={y + padY + 1}
          textAnchor="middle"
          style={{ font: "500 9.5px var(--font-jetbrains-mono, monospace)" }}
          fill={color}
        >
          {text}
        </text>
      )}
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* Node                                                                        */
/* -------------------------------------------------------------------------- */

interface DwhNodeRectProps {
  node: DwhNode;
  x: number;
  y: number;
  geom: (typeof GEOM)[keyof typeof GEOM];
  selected: boolean;
  compare: boolean;
  dim: boolean;
  highlighted: boolean;
  pinned: boolean;
  flashing: boolean;
  critical: boolean;
  onSelect: (id: string) => void;
  onContextMenu?: (id: string, x: number, y: number) => void;
  onCompareClick?: (id: string) => void;
}

function DwhNodeRect({
  node,
  x,
  y,
  geom,
  selected,
  compare,
  dim,
  highlighted,
  pinned,
  flashing,
  critical,
  onSelect,
  onContextMenu,
  onCompareClick,
}: DwhNodeRectProps) {
  const palette = STATUS_TOKEN[node.status];
  const aria =
    `${node.layer === "silver" ? "Fact" : "Tabla"} ${node.fullName}, ` +
    `estado ${node.status}, ${node.rowsLast24h} filas en últimas 24 h` +
    (pinned ? ", fijado" : "");

  const strokeColor = pinned
    ? "var(--color-primary)"
    : critical
      ? "var(--color-destructive)"
      : compare
        ? "var(--color-info)"
        : selected
          ? "var(--color-primary)"
          : highlighted
            ? "var(--color-ring)"
            : palette.ring;
  const strokeWidth = pinned
    ? 2.2
    : selected
      ? 2
      : compare
        ? 2
        : critical
          ? 1.8
          : highlighted
            ? 1.5
            : 1;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <g
          data-dwh-node
          role="button"
          tabIndex={0}
          aria-label={aria}
          aria-pressed={selected}
          onClick={(e) => {
            // Shift+click → modo compare (si el host lo soporta).
            if (e.shiftKey && onCompareClick) {
              e.preventDefault();
              onCompareClick(node.id);
              return;
            }
            onSelect(node.id);
          }}
          onContextMenu={(e) => {
            if (!onContextMenu) return;
            e.preventDefault();
            onContextMenu(node.id, e.clientX, e.clientY);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(node.id);
            }
          }}
          className={cn(
            "cursor-pointer outline-none transition-opacity",
            flashing && "dwh-node-flash",
          )}
          style={{ opacity: dim ? 0.32 : 1 }}
        >
          {pinned ? (
            <rect
              x={x - 2}
              y={y - 2}
              width={geom.NODE_W + 4}
              height={geom.NODE_H + 4}
              rx={10}
              ry={10}
              fill="none"
              stroke="var(--color-primary)"
              strokeOpacity={0.35}
              strokeWidth={1.5}
              filter="url(#dwh-pin-glow)"
            />
          ) : null}
          <rect
            x={x}
            y={y}
            width={geom.NODE_W}
            height={geom.NODE_H}
            rx={8}
            ry={8}
            fill="var(--color-surface-2)"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
          />
          <circle cx={x + 14} cy={y + 14} r={4} fill={palette.dot} />
          <text
            x={x + 28}
            y={y + 18}
            style={{ font: "500 12px var(--font-jetbrains-mono, monospace)" }}
            className="fill-[var(--color-text)]"
          >
            {truncate(node.label, geom.LABEL_MAX - (pinned ? 2 : 0))}
          </text>
          {pinned ? (
            <g transform={`translate(${x + geom.NODE_W - 16} ${y + 8})`}>
              <circle r={6} fill="var(--color-primary)" opacity={0.18} />
              <Pin
                width={9}
                height={9}
                x={-4.5}
                y={-4.5}
                strokeWidth={2}
                stroke="var(--color-primary)"
                fill="none"
              />
            </g>
          ) : null}
          {geom.NODE_H >= 52 ? (
            <>
              <text
                x={x + 14}
                y={y + 38}
                style={{ font: "400 10px var(--font-inter, sans-serif)" }}
                className="fill-[var(--color-text-muted)]"
              >
                {node.rowsLast24h > 0
                  ? `${formatRows(node.rowsLast24h)} · 24h`
                  : node.lastLoadAt
                    ? "sin carga reciente"
                    : "sin datos"}
              </text>
              {node.layer !== "silver" && node.facts.length > 0 ? (
                <text
                  x={x + 14}
                  y={y + 50}
                  style={{ font: "400 9px var(--font-inter, sans-serif)" }}
                  className="fill-[var(--color-text-muted)]"
                >
                  {node.facts.length === 1
                    ? `→ ${shortFact(node.facts[0])}`
                    : `→ ${node.facts.length} facts`}
                </text>
              ) : null}
              <NodeSparkline
                x={x + geom.NODE_W - 70}
                y={y + 32}
                w={56}
                h={16}
                seed={node.id}
                latest={node.rowsLast24h}
                status={node.status}
              />
            </>
          ) : null}
        </g>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        className="max-w-xs px-3 py-2"
      >
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs font-semibold text-[var(--color-text)]">
            {node.fullName}
          </span>
          <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: palette.dot }}
            />
            <span className="capitalize">{node.status}</span>
            <span aria-hidden>·</span>
            <span>
              {node.lastLoadAt
                ? `cargado ${formatDateTime(node.lastLoadAt)}`
                : "sin cargas"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px]">
            <span className="tabular-nums">
              <span className="text-[var(--color-text-muted)]">filas 24h: </span>
              <span className="font-medium text-[var(--color-text)]">
                {formatNumber(node.rowsLast24h)}
              </span>
            </span>
            <span className="tabular-nums">
              <span className="text-[var(--color-text-muted)]">rechazadas: </span>
              <span
                className={cn(
                  "font-medium",
                  node.rejectedLast24h > 0
                    ? "text-[var(--color-warning)]"
                    : "text-[var(--color-text)]",
                )}
              >
                {formatNumber(node.rejectedLast24h)}
              </span>
            </span>
          </div>
          {pinned ? (
            <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-[var(--color-primary)]">
              <Pin aria-hidden className="h-3 w-3" />
              Nodo fijado por ti
            </div>
          ) : null}
          {node.facts.length > 0 ? (
            <div className="mt-1 text-[10px] text-[var(--color-text-muted)]">
              {node.facts.length === 1
                ? `Asociado a ${shortFact(node.facts[0])}`
                : `${node.facts.length} facts asociados`}
            </div>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/* -------------------------------------------------------------------------- */
/* Sparkline (mock determinístico hasta tener endpoint /timeseries)            */
/* -------------------------------------------------------------------------- */

function NodeSparkline({
  x,
  y,
  w,
  h,
  seed,
  latest,
  status,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  seed: string;
  latest: number;
  status: TableStatus;
}) {
  // Generamos 7 puntos determinísticos por nodo. El último punto = `latest`
  // real para anclar la mini-línea a un valor confiable. El resto es ±25%
  // alrededor de `latest` o un fallback chico si no hay datos.
  const points = useMemo(() => mockSeries(seed, latest, 7), [seed, latest]);
  if (latest <= 0 && points.every((p) => p === 0)) return null;
  const max = Math.max(1, ...points);
  const stroke =
    status === "failed"
      ? "var(--color-destructive)"
      : status === "warning"
        ? "var(--color-warning)"
        : status === "stale"
          ? "var(--color-text-muted)"
          : "var(--color-success)";
  const d = points
    .map((p, i) => {
      const px = x + (i / (points.length - 1)) * w;
      const py = y + h - (p / max) * h;
      return `${i === 0 ? "M" : "L"} ${px.toFixed(2)} ${py.toFixed(2)}`;
    })
    .join(" ");
  return (
    <g aria-hidden opacity={0.85}>
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.2} />
      {/* Punto final destacado */}
      <circle
        cx={x + w}
        cy={y + h - (points[points.length - 1] / max) * h}
        r={1.6}
        fill={stroke}
      />
    </g>
  );
}

function mockSeries(seed: string, latest: number, n: number): number[] {
  // Hash determinista del seed (FNV-1a 32-bit-ish, suficiente para variar).
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const base = latest > 0 ? latest : ((h >>> 0) % 1500) + 200;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    // PRNG simple basado en h.
    h = Math.imul(h ^ i, 2654435761);
    const noise = ((h >>> 8) & 0xffff) / 0xffff; // [0,1)
    const swing = (noise - 0.5) * 0.5; // ±25%
    out.push(Math.max(0, Math.round(base * (1 + swing))));
  }
  // Anclar el último punto al valor real.
  if (latest > 0) out[out.length - 1] = latest;
  return out;
}

/* -------------------------------------------------------------------------- */
/* Viewport controls (floating top-right)                                      */
/* -------------------------------------------------------------------------- */

function ViewportControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Controles de vista"
      className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-1 shadow-sm backdrop-blur"
    >
      <CtrlBtn label="Reducir zoom" onClick={onZoomOut} disabled={zoom <= ZOOM_MIN}>
        <Minus className="h-3.5 w-3.5" />
      </CtrlBtn>
      <span
        className="min-w-[3rem] text-center text-[11px] tabular-nums text-[var(--color-text-muted)]"
        aria-live="polite"
      >
        {Math.round(zoom * 100)}%
      </span>
      <CtrlBtn label="Aumentar zoom" onClick={onZoomIn} disabled={zoom >= ZOOM_MAX}>
        <Plus className="h-3.5 w-3.5" />
      </CtrlBtn>
      <span aria-hidden className="mx-0.5 h-4 w-px bg-[var(--color-border)]" />
      <CtrlBtn label="Restaurar vista" onClick={onReset}>
        <RotateCcw className="h-3.5 w-3.5" />
      </CtrlBtn>
    </div>
  );
}

function CtrlBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-sm text-[var(--color-text-secondary)] transition",
        "hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
        "disabled:cursor-not-allowed disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function shortFact(s: string): string {
  return s.replace(/^Fact_/, "").replace(/_/g, " ");
}

function formatRows(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

function nodeMatchesFilter(
  nodes: DwhNode[],
  id: string,
  lower: string,
): boolean {
  const n = nodes.find((x) => x.id === id);
  if (!n) return false;
  return (
    n.label.toLowerCase().includes(lower) ||
    n.fullName.toLowerCase().includes(lower) ||
    n.facts.some((f) => f.toLowerCase().includes(lower))
  );
}

const COLLAPSED_W = 24;

interface ColumnInfo {
  left: number;
  width: number;
  collapsed: boolean;
  count: number;
}

interface Layout {
  positions: Map<string, { x: number; y: number; layer: Layer }>;
  columns: Record<Layer, ColumnInfo>;
  dimensions: { width: number; height: number };
}

function computeLayout(
  nodes: DwhNode[],
  geom: (typeof GEOM)[keyof typeof GEOM],
  collapsedLayers: ReadonlySet<LayerName>,
): Layout {
  const positions = new Map<string, { x: number; y: number; layer: Layer }>();
  const columns = {} as Record<Layer, ColumnInfo>;
  let maxRows = 0;
  let cursorX = SVG_PAD_X;
  LAYER_ORDER.forEach((layer) => {
    const inLayer = nodes.filter((n) => n.layer === layer);
    const collapsed = collapsedLayers.has(layer) && inLayer.length > 0;
    const width = collapsed ? COLLAPSED_W : geom.NODE_W;
    columns[layer] = {
      left: cursorX,
      width,
      collapsed,
      count: inLayer.length,
    };
    inLayer.forEach((n, idx) => {
      const y = COLUMN_PAD_TOP + idx * (geom.NODE_H + geom.NODE_GAP_Y);
      positions.set(n.id, { x: cursorX, y, layer });
    });
    if (inLayer.length > maxRows) maxRows = inLayer.length;
    cursorX += width + geom.COLUMN_GAP_X;
  });
  // El último gap sobra → restamos.
  const totalWidth = cursorX - geom.COLUMN_GAP_X + SVG_PAD_X;
  const height =
    COLUMN_PAD_TOP + maxRows * (geom.NODE_H + geom.NODE_GAP_Y) + SVG_PAD_BOTTOM;
  return { positions, columns, dimensions: { width: totalWidth, height } };
}

/* -------------------------------------------------------------------------- */
/* Legend                                                                     */
/* -------------------------------------------------------------------------- */

interface LegendProps {
  className?: string;
}

export function DwhLineageLegend({ className }: LegendProps) {
  const items: { label: string; status: TableStatus }[] = [
    { label: "OK", status: "ok" },
    { label: "Advertencia", status: "warning" },
    { label: "Falló", status: "failed" },
    { label: "Stale (> 3 d)", status: "stale" },
    { label: "Sin datos", status: "unknown" },
  ];
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-text-muted)]",
        className,
      )}
    >
      {items.map((it) => (
        <span key={it.status} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: STATUS_TOKEN[it.status].dot }}
          />
          {it.label}
        </span>
      ))}
      <span aria-hidden className="text-[var(--color-text-muted)]">·</span>
      <span className="inline-flex items-center gap-1.5">
        <svg width="22" height="6" aria-hidden>
          <line
            x1="0"
            y1="3"
            x2="22"
            y2="3"
            stroke="var(--color-text-muted)"
            strokeDasharray="3 3"
          />
        </svg>
        dependencia entre facts
      </span>
      <span aria-hidden className="text-[var(--color-text-muted)]">·</span>
      <span className="inline-flex items-center gap-1.5">
        <Maximize2 aria-hidden className="h-3 w-3" />
        click + drag para pan · ? atajos
      </span>
      <span aria-hidden className="text-[var(--color-text-muted)]">·</span>
      <span className="inline-flex items-center gap-1.5">
        <AlertTriangle aria-hidden className="h-3 w-3 text-[var(--color-warning)]" />
        ⚠ en edge: filas rechazadas en 24h
      </span>
    </div>
  );
}
