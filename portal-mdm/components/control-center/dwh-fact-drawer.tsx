"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import Link from "next/link";
import {
  ArrowRight,
  Database,
  GitBranch,
  Layers,
  PlayCircle,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { DwhNode, FactSummary } from "@/lib/schemas/dwh";

interface DwhFactDrawerProps {
  node: DwhNode | null;
  fact: FactSummary | null;
  onClose: () => void;
}

const STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "destructive" | "default" | "info"
> = {
  ok: "success",
  warning: "warning",
  failed: "destructive",
  stale: "default",
  unknown: "default",
};

const LAYER_LABEL = {
  bronce: "Bronce",
  silver: "Silver",
  gold: "Gold",
} as const;

export function DwhFactDrawer({ node, fact, onClose }: DwhFactDrawerProps) {
  const open = node !== null;
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col",
            "border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl outline-none",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right",
          )}
        >
          {node ? <DrawerBody node={node} fact={fact} onClose={onClose} /> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

interface DrawerBodyProps {
  node: DwhNode;
  fact: FactSummary | null;
  onClose: () => void;
}

function DrawerBody({ node, fact, onClose }: DrawerBodyProps) {
  return (
    <>
      <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="info">{LAYER_LABEL[node.layer]}</Badge>
            <Badge variant={STATUS_VARIANT[node.status]}>
              {node.status.toUpperCase()}
            </Badge>
          </div>
          <DialogPrimitive.Title
            className="break-all font-mono text-base font-semibold text-[var(--color-text)]"
            title={node.fullName}
          >
            {node.fullName}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-xs text-[var(--color-text-muted)]">
            {node.rowsLast24h > 0
              ? `${formatNumber(node.rowsLast24h)} filas insertadas en últimas 24 h`
              : "Sin actividad en últimas 24 h"}
          </DialogPrimitive.Description>
        </div>
        <DialogPrimitive.Close
          aria-label="Cerrar"
          className="rounded-sm p-1 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <section
          aria-label="Métricas"
          className="grid grid-cols-2 gap-3"
        >
          <Metric label="Filas 24 h" value={formatNumber(node.rowsLast24h)} />
          <Metric
            label="Rechazadas 24 h"
            value={formatNumber(node.rejectedLast24h)}
            tone={node.rejectedLast24h > 0 ? "warning" : "default"}
          />
          <Metric
            label="Última carga"
            value={node.lastLoadAt ? formatDateTime(node.lastLoadAt) : "—"}
            wide
          />
        </section>

        {fact ? <FactDetail fact={fact} /> : <NonFactDetail node={node} />}

        {fact ? (
          <div className="mt-6 flex items-center gap-2">
            <Button asChild variant="primary" size="sm" onClick={onClose}>
              <Link href={`/etl-monitor/lanzar?fact=${encodeURIComponent(fact.nombre)}`}>
                <PlayCircle aria-hidden className="h-4 w-4" />
                Re-procesar este fact
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" onClick={onClose}>
              <Link href="/etl-monitor">
                Ver corridas
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}

/* ── Sub-views ───────────────────────────────────────────────────────────── */

function FactDetail({ fact }: { fact: FactSummary }) {
  return (
    <>
      <Section title="Estrategia de rerun">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {fact.estrategiaRerun}
        </p>
      </Section>

      <Section title="Fuentes Bronce" icon={<Database className="h-3.5 w-3.5" />}>
        {fact.fuentesBronce.length === 0 ? (
          <Empty>No declara fuentes Bronce</Empty>
        ) : (
          <TableList items={fact.fuentesBronce} />
        )}
      </Section>

      {fact.dependencias.length > 0 ? (
        <Section
          title="Dependencias de facts"
          icon={<GitBranch className="h-3.5 w-3.5" />}
        >
          <TableList items={fact.dependencias} />
        </Section>
      ) : null}

      <Section title="Marts Gold" icon={<Layers className="h-3.5 w-3.5" />}>
        {fact.marts.length === 0 ? (
          <Empty>No genera marts Gold</Empty>
        ) : (
          <TableList items={fact.marts} />
        )}
      </Section>
    </>
  );
}

function NonFactDetail({ node }: { node: DwhNode }) {
  return (
    <Section
      title={
        node.layer === "bronce"
          ? "Facts que consumen esta tabla"
          : "Facts que alimentan este mart"
      }
      icon={
        node.layer === "bronce" ? (
          <Database className="h-3.5 w-3.5" />
        ) : (
          <Layers className="h-3.5 w-3.5" />
        )
      }
    >
      {node.facts.length === 0 ? (
        <Empty>Sin facts asociados</Empty>
      ) : (
        <TableList items={node.facts} />
      )}
    </Section>
  );
}

/* ── Atomic UI ───────────────────────────────────────────────────────────── */

interface MetricProps {
  label: string;
  value: string;
  tone?: "default" | "warning";
  wide?: boolean;
}

function Metric({ label, value, tone = "default", wide }: MetricProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3",
        wide && "col-span-2",
      )}
    >
      <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums text-base font-semibold",
          tone === "warning"
            ? "text-[var(--color-warning)]"
            : "text-[var(--color-text)]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="mt-5 flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
        {icon ? <span aria-hidden>{icon}</span> : null}
        {title}
      </h3>
      <div>{children}</div>
    </section>
  );
}

function TableList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((it) => (
        <li
          key={it}
          className="break-all rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 font-mono text-xs text-[var(--color-text-secondary)]"
          title={it}
        >
          {it}
        </li>
      ))}
    </ul>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded border border-dashed border-[var(--color-border)] px-3 py-2 text-xs italic text-[var(--color-text-muted)]">
      {children}
    </p>
  );
}
