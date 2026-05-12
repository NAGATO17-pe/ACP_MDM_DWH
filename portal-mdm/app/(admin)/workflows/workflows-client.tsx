"use client";

import * as React from "react";
import { Check, Clock, GitPullRequestArrow, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Stepper, type StepperStep } from "@/components/ui/stepper";
import { useToast } from "@/hooks/use-toast";
import { getWorkflows, approveWorkflow, rejectWorkflow } from "@/lib/api/workflows";
import { getErrorMessage } from "@/lib/api/client";
import {
  WORKFLOW_STATUS_LABEL,
  WORKFLOW_STATUS_VARIANT,
  WORKFLOW_TYPE_LABEL,
  rejectWorkflowSchema,
  type RejectWorkflowInput,
  type WorkflowFromApi,
  type WorkflowStatus,
} from "@/lib/schemas/workflows";
import { qk } from "@/lib/query-keys";
import { formatDateTime } from "@/lib/format";

const STEPPER_STEPS: readonly StepperStep[] = [
  { key: "pendiente", label: "Pendiente" },
  { key: "en-revision", label: "En revisión" },
  { key: "aprobado", label: "Decisión" },
];

function statusToStep(status: WorkflowStatus): { idx: number; isDone: boolean } {
  const idx = status === "pendiente" ? 0 : status === "en-revision" ? 1 : 2;
  const isDone = status !== "pendiente" && (status !== "en-revision" || idx > 1);
  // Decision step is "done" only when actually approved/rejected
  return {
    idx,
    isDone: status === "aprobado" || status === "rechazado",
  };
}

interface WorkflowBuckets {
  pending: WorkflowFromApi[];
  approved: number;
  rejected: number;
  historical: WorkflowFromApi[];
}

function bucketize(workflows: WorkflowFromApi[]): WorkflowBuckets {
  const buckets: WorkflowBuckets = { pending: [], approved: 0, rejected: 0, historical: [] };
  for (const w of workflows) {
    if (w.status === "pendiente" || w.status === "en-revision") {
      buckets.pending.push(w);
    } else {
      buckets.historical.push(w);
      if (w.status === "aprobado") buckets.approved += 1;
      else if (w.status === "rechazado") buckets.rejected += 1;
    }
  }
  return buckets;
}

export function WorkflowsClient() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rejectTarget, setRejectTarget] = React.useState<WorkflowFromApi | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RejectWorkflowInput>({
    resolver: zodResolver(rejectWorkflowSchema),
    defaultValues: { reason: "" },
  });

  const { data, isLoading } = useQuery({
    queryKey: qk.workflows(),
    queryFn: () => getWorkflows(),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.workflows() });
      toast({ title: "Workflow aprobado", variant: "success" });
    },
    onError: (err) => {
      toast({ title: "Error al aprobar", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: RejectWorkflowInput }) =>
      rejectWorkflow(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.workflows() });
      toast({ title: "Workflow rechazado", variant: "default" });
      closeRejectDialog();
    },
    onError: (err) => {
      toast({ title: "Error al rechazar", description: getErrorMessage(err), variant: "destructive" });
    },
  });

  function closeRejectDialog() {
    setRejectTarget(null);
    reset();
  }

  function onSubmitReject(values: RejectWorkflowInput) {
    if (!rejectTarget) return;
    rejectMutation.mutate({ id: rejectTarget.id, body: values });
  }

  const buckets = React.useMemo(() => bucketize(data?.data ?? []), [data]);

  return (
    <>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Workflows de aprobación"
          description="Cola de solicitudes, revisión de cambios y acciones de aprobación."
        />

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard label="En cola" value={isLoading ? "—" : buckets.pending.length} icon={Clock} tone="warning" />
          <KpiCard label="Aprobados (mes)" value={isLoading ? "—" : buckets.approved} icon={Check} tone="success" />
          <KpiCard label="Rechazados (mes)" value={isLoading ? "—" : buckets.rejected} icon={X} tone="destructive" />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Cola de pendientes</CardTitle>
            <CardDescription>Solicitudes esperando revisión o decisión final.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3" aria-live="polite">
            {isLoading ? (
              <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando workflows">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] p-4">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 rounded-full" />
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : buckets.pending.length === 0 ? (
              <EmptyState
                icon={GitPullRequestArrow}
                title="Sin workflows pendientes"
                description="No hay solicitudes en cola en este momento."
              />
            ) : (
              buckets.pending.map((wf) => {
                const step = statusToStep(wf.status);
                return (
                  <article
                    key={wf.id}
                    className="bg-[var(--color-surface-2)]/40 flex flex-col gap-3 rounded-md border border-[var(--color-border)] p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <GitPullRequestArrow aria-hidden className="h-4 w-4 text-[var(--color-primary)]" />
                        <span className="font-mono text-xs text-[var(--color-text-muted)]">{wf.id}</span>
                        <Badge variant="primary">{WORKFLOW_TYPE_LABEL[wf.type]}</Badge>
                        <Badge variant={WORKFLOW_STATUS_VARIANT[wf.status]}>{WORKFLOW_STATUS_LABEL[wf.status]}</Badge>
                      </div>
                      <p className="font-medium">{wf.entityName}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {wf.changes} cambios · solicitado por {wf.requestedBy} · {formatDateTime(wf.createdAt)}
                      </p>
                      <div className="pt-1">
                        <Stepper
                          steps={STEPPER_STEPS}
                          currentIndex={step.idx}
                          currentIsDone={step.isDone}
                          ariaLabel="Progreso del workflow"
                        />
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
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico reciente</CardTitle>
            <CardDescription>Workflows aprobados o rechazados en los últimos días.</CardDescription>
          </CardHeader>
          <CardContent>
            {buckets.historical.length === 0 ? (
              <EmptyState icon={GitPullRequestArrow} title="Sin histórico disponible" />
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {buckets.historical.map((wf) => (
                  <li key={wf.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-[var(--color-text-muted)]">{wf.id}</span>
                      <span className="text-sm">{wf.entityName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--color-text-muted)]">{formatDateTime(wf.createdAt)}</span>
                      <Badge variant={WORKFLOW_STATUS_VARIANT[wf.status]}>{WORKFLOW_STATUS_LABEL[wf.status]}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) closeRejectDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar workflow</DialogTitle>
            <DialogDescription>
              Indica el motivo del rechazo para <span className="font-medium">{rejectTarget?.entityName}</span>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmitReject)} className="flex flex-col gap-2 py-2">
            <Label htmlFor="reject-reason">Motivo</Label>
            <Input
              id="reject-reason"
              placeholder="Ej: Documentación incompleta…"
              {...register("reason")}
            />
            {errors.reason && (
              <p className="text-xs text-[var(--color-destructive)]">{errors.reason.message}</p>
            )}
            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={closeRejectDialog}>
                Cancelar
              </Button>
              <Button type="submit" variant="destructive" disabled={rejectMutation.isPending}>
                Confirmar rechazo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
