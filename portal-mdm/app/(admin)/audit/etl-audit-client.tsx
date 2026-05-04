"use client";

import { useState } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  SkipForward, 
  AlertCircle,
  FileSearch
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table/data-table";
import type { EtlLog } from "@/lib/schemas/audit-etl";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface EtlAuditClientProps {
  initialLogs: EtlLog[];
}

const STATUS_CONFIG = {
  OK: { label: "Éxito", icon: CheckCircle2, variant: "success" as const },
  ERROR: { label: "Fallo", icon: XCircle, variant: "destructive" as const },
  RUNNING: { label: "Corriendo", icon: Loader2, variant: "info" as const },
  SKIPPED: { label: "Omitido", icon: SkipForward, variant: "warning" as const },
  TIMEOUT: { label: "Timeout", icon: AlertCircle, variant: "destructive" as const },
};

export function EtlAuditClient({ initialLogs }: EtlAuditClientProps) {
  const [logs] = useState(initialLogs);

  const columns = [
    {
      accessorKey: "id_log",
      header: "ID",
      cell: ({ row }: any) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.getValue("id_log")}
        </span>
      ),
    },
    {
      accessorKey: "tabla_destino",
      header: "Tabla Destino",
      cell: ({ row }: any) => (
        <span className="font-medium">{row.getValue("tabla_destino")}</span>
      ),
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }: any) => {
        const status = row.getValue("estado") as keyof typeof STATUS_CONFIG;
        const config = STATUS_CONFIG[status] || { label: status, variant: "default" };
        const Icon = config.icon;

        return (
          <Badge variant={config.variant} className="gap-1 px-2 py-0.5">
            {Icon && <Icon className={cn("h-3 w-3", status === "RUNNING" && "animate-spin")} />}
            {config.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "filas_insertadas",
      header: "Filas OK",
      cell: ({ row }: any) => (
        <span className="tabular-nums font-medium text-success-foreground">
          {row.getValue("filas_insertadas").toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "filas_rechazadas",
      header: "Rechazadas",
      cell: ({ row }: any) => {
        const val = row.getValue("filas_rechazadas") as number;
        return (
          <span className={cn("tabular-nums font-medium", val > 0 ? "text-destructive" : "text-muted-foreground")}>
            {val.toLocaleString()}
          </span>
        );
      },
    },
    {
      accessorKey: "fecha_inicio",
      header: "Inicio",
      cell: ({ row }: any) => (
        <span className="text-xs text-muted-foreground">
          {formatDateTime(row.getValue("fecha_inicio"))}
        </span>
      ),
    },
    {
      accessorKey: "duracion_segundos",
      header: "Duración",
      cell: ({ row }: any) => {
        const sec = row.getValue("duracion_segundos") as number;
        if (!sec) return <span className="text-muted-foreground">—</span>;
        const mins = Math.floor(sec / 60);
        const remainingSec = Math.floor(sec % 60);
        return (
          <span className="text-xs font-medium">
            {mins > 0 ? `${mins}m ` : ""}{remainingSec}s
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }: any) => {
        const error = row.original.mensaje_error;
        if (!error) return null;
        return (
          <div className="flex justify-end">
             <Badge variant="outline" className="text-[10px] uppercase tracking-tighter text-destructive border-destructive/20 bg-destructive/5">
               Ver Error
             </Badge>
          </div>
        );
      }
    }
  ];

  return (
    <div className="flex flex-col gap-4">
      <DataTable 
        columns={columns} 
        data={logs} 
        searchPlaceholder="Filtrar por tabla..."
        searchColumn="tabla_destino"
      />
    </div>
  );
}
