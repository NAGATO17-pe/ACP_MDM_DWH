"use client";

import * as React from "react";
import { Check, Clock, GitPullRequestArrow, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KpiCard } from "@/components/charts/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { getWorkflows, approveWorkflow, rejectWorkflow } from "@/lib/api/workflows";
import type { WorkflowFromApi } from "@/lib/schemas/workflows";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type WorkflowStatus = WorkflowFromApi["status"];
type WorkflowType = WorkflowFromApi["type"];

const STATUS_VARIANT: Record<WorkflowStatus, "warning" | "info" | "success" | "destructive"> = {
  pendiente: "warning",
  "en-revision": "info",
  aprobado: "success",
  rechazado: "destructive",
};

const STATUS_LABEL: Record<WorkflowStatus, string> = {
  pendiente: "Pendiente",
  "en-revision": "En revisión",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

const TYPE_LABEL: Record<WorkflowType, string> = {
  alta: "Alta",
  modificacion: "Modificación",
  baja: "Baja",
};

const STEPPER_STEPS = [
  { key: "pendiente", label: "Pendiente" },
  { key: "en-revision", label: "En revisión" },
  { key: "aprobado", label: "Decisión" },
] as const;

function Stepper({ status }: { status: WorkflowStatus }) {
  const idx = status === "pendiente" ? 0 : status === "en-revision" ? 1 : 2;
  return (
    <ol className="flex items-center gap-3" aria-label="Progreso del workflow">
      {STEPPER_STEPS.map((step, i) => {
        const done = i < idx || (i === idx && status !== "pendiente");
        const current = i === idx;
        return (
          <li key={step.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className={
                done
                  ? "bg-[var(--color-success)] text-white inline-flex h-6 w-6 items-center justify-center rounded-full text-xs"
                  : current
                    ? "bg-[var(--color-primary)] text-white inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ring-2 ring-[var(--color-primary)]/30"
                    : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] inline-flex h-6 w-6 items-center justify-center rounded-full text-xs"
              }
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={done || current ? "text-xs font-medium" : "text-xs text-[var(--color-text-muted)]"}>
              {step.label}
            </span>
            {i < STEPPER_STEPS.length - 1 && (
              <span aria-hidden className={done ? "bg-[var(--color-success)] h-px w-8" : "bg-[var(--color-border)] h-px w-8"} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function WorkflowsClient() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = React.useState<WorkflowFromApi | null>(null);
  const [reason, setReason] = React.useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: () => getWorkflows(),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast({ title: "Workflow aprobado", variant: "success" });
    },
    onError: () => {
      toast({ title: "Error al aprobar", description: "Intenta nuevamente.", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectWorkflow(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      toast({ title: "Workflow rechazado", variant: "default" });
      setRejectTarget(null);
      setReason("");
    },
    onError: () => {
      toast({ title: "Error al rechazar", description: "Intenta nuevamente.", variant: "destructive" });
    },
  });

  const workflows = data?.data ?? [];
  const pending = workflows.filter((w) => w.status === "pendiente" || w.status === "en-revision");
  const approved = workflows.filter((w) => w.status === "aprobado").length;
  const rejected = workflows.filter((w) => w.status === "rechazado").length;
  const historical = workflows.filter((w) => w.status === "aprobado" || w.status === "rechazado");

  return (
    <>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Workflows de aprobación"
          description="Cola de solicitudes, revisión de cambios y acciones de aprobación."
        />

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard label="En cola" value={isLoading ? "—" : pending.length} icon={Clock} tone="warning" />
          <KpiCard label="Aprobados (mes)" value={isLoading ? "—" : approved} icon={Check} tone="success" />
          <KpiCard label="Rechazados (mes)" value={isLoading ? "—" : rejected} icon={X} tone="destructive" />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Cola de pendientes</CardTitle>
            <CardDescription>Solicitudes esperando revisión o decisión final.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">Cargando…</p>
            ) : pending.length === 0 ? (
              <EmptyState
                icon={GitPullRequestArrow}
                title="Sin workflows pendientes"
                description="No hay solicitudes en cola en este momento."
              />
            ) : (
              pending.map((wf) => (
                <article
                  key={wf.id}
                  className="bg-[var(--color-surface-2)]/40 flex flex-col gap-3 rounded-md border border-[var(--color-border)] p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <GitPullRequestArrow aria-hidden className="h-4 w-4 text-[var(--color-primary)]" />
                      <span className="font-mono text-xs text-[var(--color-text-muted)]">{wf.id}</span>
                      <Badge variant="primary">{TYPE_LABEL[wf.type]}</Badge>
                      <Badge variant={STATUS_VARIANT[wf.status]}>{STATUS_LABEL[wf.status]}</Badge>
                    </div>
                    <p className="font-medium">{wf.entityName}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {wf.changes} cambios · solicitado por {wf.requestedBy} · {formatDateTime(wf.createdAt)}
                    </p>
                    <div className="pt-1">
                      <Stepper status={wf.status} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={rejectMutation.isPending}
                      onClick={() => setRejectTarget(wf)}
                    >
                      <X aria-hidden className="h-4 w-4" />
                      Rechazar
                    </Button>
                    <Button
                      variant="success"
                      size="sm"
                      disabled={approveMutation.isPending}
                      onClick={() => approveMutation.mutate(wf.id)}
                    >
                      <Check aria-hidden className="h-4 w-4" />
                      Aprobar
                    </Button>
                  </div>
                </article>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico reciente</CardTitle>
            <CardDescription>Workflows aprobados o rechazados en los últimos días.</CardDescription>
          </CardHeader>
          <CardContent>
            {historical.length === 0 ? (
              <EmptyState icon={GitPullRequestArrow} title="Sin histórico disponible" />
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {historical.map((wf) => (
                  <li key={wf.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-[var(--color-text-muted)]">{wf.id}</span>
                      <span className="text-sm">{wf.entityName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--color-text-muted)]">{formatDateTime(wf.createdAt)}</span>
                      <Badge variant={STATUS_VARIANT[wf.status]}>{STATUS_LABEL[wf.status]}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de confirmación de rechazo */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar workflow</DialogTitle>
            <DialogDescription>
              Indica el motivo del rechazo para <span className="font-medium">{rejectTarget?.entityName}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="reject-reason">Motivo</Label>
            <Input
              id="reject-reason"
              placeholder="Ej: Documentación incompleta…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setReason(""); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || rejectMutation.isPending}
              onClick={() => {
                if (rejectTarget) rejectMutation.mutate({ id: rejectTarget.id, reason });
              }}
            >
              Confirmar rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
