"use client";

/**
 * components/control-center/dwh-minimap.tsx
 * =========================================
 * Mapa navegador estilo Figma/Miro para el lineage graph.
 *
 * Renderiza una versión miniatura del grafo en un cuadro fijo
 * (`MAP_W × MAP_H`) con un rectángulo translúcido que representa el viewport
 * actual del contenedor scrollable. Drag sobre el rectángulo (o click en
 * cualquier punto del mapa) reposiciona la vista.
 *
 * El minimap NO conoce el estado de zoom/pan del SVG — lo controla a través
 * del scrollLeft/scrollTop del contenedor scrollable padre. Eso lo hace
 * idéntico a cómo Miro funciona y evita duplicar lógica de transform.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { DwhNode, TableStatus } from "@/lib/schemas/dwh";

const MAP_W = 160;
const MAP_H = 100;
const PAD = 6;

const DOT_BY_STATUS: Record<TableStatus, string> = {
  ok: "var(--color-success)",
  warning: "var(--color-warning)",
  failed: "var(--color-destructive)",
  stale: "var(--color-text-muted)",
  unknown: "var(--color-text-muted)",
};

interface DwhMinimapProps {
  /** Container scrollable que envuelve al SVG. */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Dimensiones del lienzo del grafo (en world units, antes de zoom). */
  worldWidth: number;
  worldHeight: number;
  /** Zoom actual del grafo — el contenido scrollable tiene tamaño world*zoom. */
  zoom: number;
  /** Nodos para pintar puntos en el mini-mapa. */
  nodes: DwhNode[];
  /** Geometría de los nodos para localizar puntos (necesitamos x,y). */
  positions: Map<string, { x: number; y: number }>;
  nodeWidth: number;
  nodeHeight: number;
}

export function DwhMinimap({
  scrollContainerRef,
  worldWidth,
  worldHeight,
  zoom,
  nodes,
  positions,
  nodeWidth,
  nodeHeight,
}: DwhMinimapProps) {
  const [viewport, setViewport] = useState({ x: 0, y: 0, w: MAP_W, h: MAP_H });
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  // Escala mapa-world. El minimap mantiene aspect ratio del world.
  const scaleX = (MAP_W - PAD * 2) / Math.max(worldWidth, 1);
  const scaleY = (MAP_H - PAD * 2) / Math.max(worldHeight, 1);
  const scale = Math.min(scaleX, scaleY);

  const recomputeViewport = useCallback(() => {
    const host = scrollContainerRef.current;
    if (!host) return;
    const { scrollLeft, scrollTop, clientWidth, clientHeight } = host;
    // El contenido tiene tamaño world*zoom — convertimos a world coords.
    const wx = scrollLeft / zoom;
    const wy = scrollTop / zoom;
    const ww = clientWidth / zoom;
    const wh = clientHeight / zoom;
    setViewport({
      x: PAD + wx * scale,
      y: PAD + wy * scale,
      w: Math.max(8, ww * scale),
      h: Math.max(8, wh * scale),
    });
  }, [scrollContainerRef, zoom, scale]);

  useLayoutEffect(() => {
    recomputeViewport();
  }, [recomputeViewport]);

  useEffect(() => {
    const host = scrollContainerRef.current;
    if (!host) return;
    const handler = () => recomputeViewport();
    host.addEventListener("scroll", handler, { passive: true });
    const ro = new ResizeObserver(handler);
    ro.observe(host);
    return () => {
      host.removeEventListener("scroll", handler);
      ro.disconnect();
    };
  }, [recomputeViewport, scrollContainerRef]);

  const moveTo = useCallback(
    (mapX: number, mapY: number) => {
      const host = scrollContainerRef.current;
      if (!host) return;
      // Centra el viewport del mapa sobre el punto donde se hizo click.
      const worldX = (mapX - PAD) / scale;
      const worldY = (mapY - PAD) / scale;
      const targetScrollLeft = worldX * zoom - host.clientWidth / 2;
      const targetScrollTop = worldY * zoom - host.clientHeight / 2;
      host.scrollTo({
        left: Math.max(0, targetScrollLeft),
        top: Math.max(0, targetScrollTop),
        behavior: "auto",
      });
    },
    [scale, scrollContainerRef, zoom],
  );

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Si hace click dentro del rectángulo, registra offset para drag relativo.
    if (
      mx >= viewport.x &&
      mx <= viewport.x + viewport.w &&
      my >= viewport.y &&
      my <= viewport.y + viewport.h
    ) {
      dragRef.current = {
        offsetX: mx - viewport.x,
        offsetY: my - viewport.y,
      };
    } else {
      // Click fuera: salto directo al punto.
      dragRef.current = { offsetX: viewport.w / 2, offsetY: viewport.h / 2 };
      moveTo(mx, my);
    }
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Movemos para que el offset inicial dentro del rectángulo se preserve.
    const targetMapX = mx - dragRef.current.offsetX + viewport.w / 2;
    const targetMapY = my - dragRef.current.offsetY + viewport.h / 2;
    moveTo(targetMapX, targetMapY);
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <div
      role="region"
      aria-label="Mini-mapa del DWH"
      className="absolute bottom-3 left-3 z-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-1 shadow-md backdrop-blur"
    >
      <svg
        width={MAP_W}
        height={MAP_H}
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="block cursor-pointer touch-none select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <rect
          x={0}
          y={0}
          width={MAP_W}
          height={MAP_H}
          fill="var(--color-surface-2)"
          rx={4}
        />
        {/* Nodos como rectángulos muy pequeños — solo posición y status. */}
        {nodes.map((n) => {
          const pos = positions.get(n.id);
          if (!pos) return null;
          const x = PAD + pos.x * scale;
          const y = PAD + pos.y * scale;
          const w = Math.max(2, nodeWidth * scale);
          const h = Math.max(1.5, nodeHeight * scale);
          return (
            <rect
              key={`mm-${n.id}`}
              x={x}
              y={y}
              width={w}
              height={h}
              rx={1}
              fill={DOT_BY_STATUS[n.status]}
              opacity={0.75}
            />
          );
        })}
        {/* Viewport rectangle */}
        <rect
          x={viewport.x}
          y={viewport.y}
          width={viewport.w}
          height={viewport.h}
          fill="color-mix(in oklab, var(--color-primary) 18%, transparent)"
          stroke="var(--color-primary)"
          strokeWidth={1.2}
          rx={2}
        />
      </svg>
    </div>
  );
}
