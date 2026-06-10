"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CorridaPaso } from "@/lib/schemas/control-center";

interface EtlExecutionLogProps {
  pasos: CorridaPaso[];
  isRunning: boolean;
  className?: string;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function fmtDur(sec: number | null, status: CorridaPaso["status"]): string {
  if (status === "running") return "ejecutando…";
  if (status === "queued") return "pendiente";
  if (status === "canceled") return "cancelado";
  if (sec == null) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

const STATUS_CFG = {
  success: {
    icon: "✓",
    rowCls: "border-l-[var(--color-success)] bg-[color-mix(in_oklab,var(--color-success)_4%,transparent)]",
    iconCls: "text-[var(--color-success)]",
    nameCls: "text-[var(--color-text)]",
    durCls: "text-[var(--color-success)]",
  },
  running: {
    icon: "◉",
    rowCls: "border-l-[var(--color-info)] bg-[color-mix(in_oklab,var(--color-info)_8%,transparent)]",
    iconCls: "text-[var(--color-info)] animate-pulse",
    nameCls: "text-[var(--color-text)] font-semibold",
    durCls: "text-[var(--color-info)]",
  },
  failed: {
    icon: "✗",
    rowCls: "border-l-[var(--color-destructive)] bg-[color-mix(in_oklab,var(--color-destructive)_6%,transparent)]",
    iconCls: "text-[var(--color-destructive)]",
    nameCls: "text-[var(--color-destructive)]",
    durCls: "text-[var(--color-destructive)]",
  },
  queued: {
    icon: "○",
    rowCls: "border-l-transparent",
    iconCls: "text-[var(--color-text-muted)]",
    nameCls: "text-[var(--color-text-muted)]",
    durCls: "text-[var(--color-text-muted)]",
  },
  canceled: {
    icon: "—",
    rowCls: "border-l-transparent",
    iconCls: "text-[var(--color-text-muted)]",
    nameCls: "text-[var(--color-text-muted)] line-through",
    durCls: "text-[var(--color-text-muted)]",
  },
} satisfies Record<CorridaPaso["status"], object>;

export function EtlExecutionLog({
  pasos,
  isRunning,
  className,
}: EtlExecutionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const sorted = [...pasos].sort((a, b) => a.orden - b.orden);

  // Auto-scroll to bottom when new steps arrive while user hasn't scrolled up.
  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [pasos.length, autoScroll]);

  function handleScroll() {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }

  function scrollToEnd() {
    setAutoScroll(true);
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-[var(--color-border)]",
        className,
      )}
    >
      {/* ── Terminal chrome ── */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2">
        <div className="flex items-center gap-3">
          {/* macOS traffic-light dots — purely decorative */}
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
            <span className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
            <span className="h-3 w-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <Terminal aria-hidden className="h-3.5 w-3.5" />
            <span className="font-mono">execution.log</span>
            {isRunning ? (
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-info)]"
                />
                <span className="text-[var(--color-info)]">live</span>
              </span>
            ) : null}
          </div>
        </div>

        {!autoScroll ? (
          <button
            onClick={scrollToEnd}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border)] hover:text-[var(--color-text)]"
            aria-label="Ir al final del log"
          >
            <ChevronDown aria-hidden className="h-3 w-3" />
            al final
          </button>
        ) : null}
      </div>

      {/* ── Log body ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        aria-label="Log de ejecución"
        aria-live={isRunning ? "polite" : "off"}
        aria-atomic="false"
        className="max-h-72 overflow-y-auto bg-[var(--color-surface)]"
      >
        {sorted.length === 0 ? (
          <p className="px-4 py-6 text-center font-mono text-xs text-[var(--color-text-muted)]">
            Esperando al runner para publicar pasos…
          </p>
        ) : (
          sorted.map((paso, idx) => {
            const cfg = STATUS_CFG[paso.status];
            const isLast = idx === sorted.length - 1;
            return (
              <div key={paso.idPaso}>
                <div
                  className={cn(
                    "flex items-center gap-3 border-l-2 px-4 py-2.5 font-mono text-xs transition-colors",
                    cfg.rowCls,
                    !isLast && "border-b border-[var(--color-border)]/40",
                  )}
                >
                  {/* Step order */}
                  <span className="w-5 shrink-0 select-none text-right text-[10px] tabular-nums text-[var(--color-text-muted)]">
                    {paso.orden}
                  </span>

                  {/* Status icon */}
                  <span
                    aria-hidden
                    className={cn("w-4 shrink-0 text-center text-sm leading-none", cfg.iconCls)}
                  >
                    {cfg.icon}
                  </span>

                  {/* Step name */}
                  <span className={cn("flex-1 truncate", cfg.nameCls)}>
                    {paso.nombre}
                  </span>

                  {/* Timestamp */}
                  <span className="shrink-0 text-[10px] tabular-nums text-[var(--color-text-muted)]">
                    {fmtTime(paso.startedAt)}
                  </span>

                  {/* Duration / status label */}
                  <span
                    className={cn(
                      "w-24 shrink-0 text-right text-[10px] tabular-nums",
                      cfg.durCls,
                    )}
                  >
                    {fmtDur(paso.durationSec, paso.status)}
                  </span>
                </div>

                {/* Error detail — inline below the failing step */}
                {paso.error ? (
                  <div className="border-b border-[var(--color-border)]/40 border-l-2 border-l-[var(--color-destructive)] bg-[color-mix(in_oklab,var(--color-destructive)_5%,transparent)] px-4 py-1.5 pl-[3.25rem] font-mono text-[10px] text-[var(--color-destructive)]">
                    <span aria-hidden className="mr-2 opacity-50">└─</span>
                    {paso.error}
                  </div>
                ) : null}
              </div>
            );
          })
        )}

        {/* Blinking cursor while running */}
        {isRunning ? (
          <div className="flex items-center gap-3 border-b border-[var(--color-border)]/40 px-4 py-2 font-mono text-[10px] text-[var(--color-text-muted)]">
            <span className="w-5 shrink-0" />
            <span aria-hidden className="animate-pulse text-[var(--color-text-muted)]">
              ▋
            </span>
            <span>esperando siguiente paso…</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
