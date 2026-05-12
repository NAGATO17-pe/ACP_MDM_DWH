"use client";

import * as React from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FilePenLine,
  FilePlus,
  History,
  LogIn,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useBlobDownload } from "@/hooks/use-blob-download";
import { getAuditLogs, downloadAuditCsv } from "@/lib/api/audit";
import { qk } from "@/lib/query-keys";
import type { AuditLog } from "@/lib/api/audit";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const ACTION_ICONS: Record<string, LucideIcon> = {
  creacion: FilePlus,
  modificacion: FilePenLine,
  aprobacion: Check,
  rechazo: X,
  eliminacion: Trash2,
  login: LogIn,
};

const ACTION_TONES: Record<string, string> = {
  creacion: "text-[var(--color-success)] bg-[color-mix(in_oklab,var(--color-success)_18%,transparent)]",
  modificacion: "text-[var(--color-info)] bg-[color-mix(in_oklab,var(--color-info)_18%,transparent)]",
  aprobacion: "text-[var(--color-success)] bg-[color-mix(in_oklab,var(--color-success)_18%,transparent)]",
  rechazo: "text-[var(--color-destructive)] bg-[color-mix(in_oklab,var(--color-destructive)_18%,transparent)]",
  eliminacion: "text-[var(--color-destructive)] bg-[color-mix(in_oklab,var(--color-destructive)_18%,transparent)]",
  login: "text-[var(--color-text-muted)] bg-[var(--color-surface-2)]",
};

const ACTION_LABEL: Record<string, string> = {
  creacion: "Creación",
  modificacion: "Modificación",
  aprobacion: "Aprobación",
  rechazo: "Rechazo",
  eliminacion: "Eliminación",
  login: "Inicio sesión",
};

const ACTION_OPTIONS = [
  { value: "", label: "Todas las acciones" },
  { value: "creacion", label: "Creación" },
  { value: "modificacion", label: "Modificación" },
  { value: "aprobacion", label: "Aprobación" },
  { value: "rechazo", label: "Rechazo" },
  { value: "eliminacion", label: "Eliminación" },
  { value: "login", label: "Inicio sesión" },
];

const PAGE_SIZE = 10;

export function AuditClient() {
  const { toast } = useToast();
  const downloadBlob = useBlobDownload();
  const [filter, setFilter] = React.useState({ action: "", page: 1 });
  const [exporting, setExporting] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: qk.audit(filter.action, filter.page),
    queryFn: () => getAuditLogs({ action: filter.action || undefined, page: filter.page, size: PAGE_SIZE }),
  });

  const events: AuditLog[] = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleFilterChange(value: string) {
    setFilter({ action: value === "__all__" ? "" : value, page: 1 });
  }

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await downloadAuditCsv();
      downloadBlob(blob, `auditoria-${new Date().toISOString().slice(0, 10)}.csv`);
      toast({ title: "CSV exportado correctamente", variant: "success" });
    } catch {
      toast({ title: "Error al exportar", description: "Intenta nuevamente.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Auditoría"
        description="Historial cronológico de eventos del portal y acciones de usuario."
        actions={
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            <Download aria-hidden className="h-4 w-4" />
            {exporting ? "Exportando…" : "Exportar CSV"}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Timeline de eventos</CardTitle>
              <CardDescription className="mt-1">
                {isLoading ? "Cargando…" : `${total} eventos registrados`}
              </CardDescription>
            </div>
            <Select value={filter.action === "" ? "__all__" : filter.action} onValueChange={handleFilterChange}>
              <SelectTrigger className="h-9 w-[200px]" aria-label="Filtrar por acción">
                <SelectValue placeholder="Todas las acciones" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value === "" ? "__all__" : o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-4 py-2" aria-busy="true" aria-label="Cargando eventos">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="flex flex-1 flex-col gap-2 pt-1">
                    <Skeleton className="h-3 w-48" />
                    <Skeleton className="h-3 w-64" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <EmptyState
              icon={History}
              title="Sin eventos"
              description="No se encontraron eventos para el filtro seleccionado."
            />
          ) : (
            <>
              <ol className="flex flex-col gap-0">
                {events.map((event, idx) => {
                  const Icon = ACTION_ICONS[event.action] ?? FilePenLine;
                  const isLast = idx === events.length - 1;
                  return (
                    <li key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span
                          aria-hidden
                          className={cn(
                            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                            ACTION_TONES[event.action] ?? ACTION_TONES.login,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        {!isLast && (
                          <span aria-hidden className="bg-[var(--color-border)] my-1 w-px flex-1" />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-1 pb-6">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-[var(--color-text-muted)]">{event.id}</span>
                          <Badge variant="default">{ACTION_LABEL[event.action] ?? event.action}</Badge>
                          <span className="tabular-nums text-xs text-[var(--color-text-muted)]">
                            {formatDateTime(event.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{event.resource}</p>
                        <p className="text-sm text-[var(--color-text-muted)]">
                          por <span className="font-medium">{event.user}</span> · {event.details}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4">
                  <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
                    Página {filter.page} de {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilter((f) => ({ ...f, page: Math.max(1, f.page - 1) }))}
                      disabled={filter.page === 1}
                      aria-label="Página anterior"
                    >
                      <ChevronLeft aria-hidden className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilter((f) => ({ ...f, page: Math.min(totalPages, f.page + 1) }))}
                      disabled={filter.page === totalPages}
                      aria-label="Página siguiente"
                    >
                      Siguiente
                      <ChevronRight aria-hidden className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
