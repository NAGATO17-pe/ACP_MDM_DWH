"use client";

import { useState, useMemo } from "react";
import { 
  CheckCircle2, 
  Clock, 
  FileWarning, 
  Table as TableIcon,
  ExternalLink,
  ChevronRight,
  Database,
  Calendar,
  Layers,
  Filter,
  XCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import type { QuarantineRecord } from "@/lib/schemas/quarantine";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface QuarantineTableProps {
  initialData: QuarantineRecord[];
}

export function QuarantineTable({ initialData }: QuarantineTableProps) {
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Obtener opciones únicas para los filtros
  const tableOptions = useMemo(() => {
    const tables = new Set(initialData.map(d => d.tabla_origen));
    return Array.from(tables).sort();
  }, [initialData]);

  const statusOptions = useMemo(() => {
    const statuses = new Set(initialData.map(d => d.estado));
    return Array.from(statuses).sort();
  }, [initialData]);

  // Filtrar datos localmente
  const filteredData = useMemo(() => {
    return initialData.filter(record => {
      const matchTable = tableFilter === "all" || record.tabla_origen === tableFilter;
      const matchStatus = statusFilter === "all" || record.estado === statusFilter;
      return matchTable && matchStatus;
    });
  }, [initialData, tableFilter, statusFilter]);

  const columns = [
    {
      accessorKey: "tabla_origen",
      header: "Origen",
      cell: ({ row }: any) => {
        const tableName = row.getValue("tabla_origen") as string;
        const isFact = tableName.toLowerCase().startsWith("fact");
        return (
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
              isFact ? "bg-blue-500/10 border-blue-500/20 text-blue-600" : "bg-purple-500/10 border-purple-500/20 text-purple-600"
            )}>
              {isFact ? <Layers className="h-4 w-4" /> : <Database className="h-4 w-4" />}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="truncate text-sm font-semibold">{tableName}</span>
              <span className="hidden sm:block text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                {row.original.columna_origen || "General"}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "valor_raw",
      header: "Valor",
      cell: ({ row }: any) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive animate-pulse" />
          <span className="truncate max-w-[80px] sm:max-w-[120px] font-mono text-xs font-medium text-destructive/90">
            {row.getValue("valor_raw") !== null ? String(row.getValue("valor_raw")) : "NULL"}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "motivo",
      header: "Motivo",
      cell: ({ row }: any) => {
        const motivo = row.getValue("motivo") as string;
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex cursor-help items-center gap-2 max-w-[200px] sm:max-w-[300px]">
                  <FileWarning className="h-3.5 w-3.5 shrink-0 text-destructive/60" />
                  <span className="truncate text-xs text-muted-foreground leading-tight">
                    {motivo || "Error de validación"}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs">{motivo}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }: any) => {
        const estado = row.getValue("estado") as string;
        const isPendiente = estado.toUpperCase() === "PENDIENTE";
        return (
          <Badge 
            variant={isPendiente ? "warning" : "success"}
            className={cn(
              "gap-1 px-2 py-0.5 text-[10px] font-bold uppercase",
              isPendiente ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
            )}
          >
            {isPendiente ? <Clock className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
            <span className="hidden xs:inline">{estado}</span>
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: () => (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ),
    }
  ];

  const resetFilters = () => {
    setTableFilter("all");
    setStatusFilter("all");
  };

  return (
    <div className="w-full space-y-4">
      {/* Barra de Filtros Específicos */}
      <div className="flex flex-wrap items-center gap-3 bg-surface/50 p-4 rounded-xl border border-border/40 mb-2">
        <div className="flex items-center gap-2 mr-2">
          <Filter className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest">Filtros</span>
        </div>

        <div className="w-full sm:w-[200px]">
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Tabla Origen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las tablas</SelectItem>
              {tableOptions.map(table => (
                <SelectItem key={table} value={table}>{table}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-[160px]">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {statusOptions.map(status => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(tableFilter !== "all" || statusFilter !== "all") && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={resetFilters}
            className="text-[10px] h-8 gap-1.5 text-muted-foreground hover:text-destructive"
          >
            <XCircle className="h-3 w-3" />
            Limpiar
          </Button>
        )}
      </div>

      {/* Vista de Escritorio: Tabla con Scroll */}
      <div className="hidden md:block overflow-hidden rounded-xl border border-border/40 bg-card shadow-sm">
        <DataTable 
          columns={columns} 
          data={filteredData} 
          searchPlaceholder="Buscar por valor o diagnóstico..."
        />
      </div>

      {/* Vista Móvil: Cards */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {filteredData.map((record, i) => (
          <div 
            key={`${record.id_registro}-${i}`}
            className="flex flex-col gap-3 rounded-xl border border-border/40 bg-card p-4 shadow-sm active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg border",
                  record.tabla_origen.toLowerCase().startsWith("fact") ? "bg-blue-500/10 border-blue-500/20 text-blue-600" : "bg-purple-500/10 border-purple-500/20 text-purple-600"
                )}>
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold tracking-tight">{record.tabla_origen}</h4>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{record.columna_origen || "General"}</p>
                </div>
              </div>
              <Badge 
                variant={record.estado.toUpperCase() === "PENDIENTE" ? "warning" : "success"}
                className="text-[10px] font-bold"
              >
                {record.estado}
              </Badge>
            </div>
            
            <div className="flex flex-col gap-2 rounded-lg bg-muted/30 p-3 border border-border/50">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Valor en conflicto:</span>
                <span className="font-mono font-bold text-destructive">{String(record.valor_raw)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">Diagnóstico:</span>
                <div className="flex items-start gap-2 text-xs font-medium text-destructive/80 leading-snug">
                  <FileWarning className="mt-0.5 h-3 w-3 shrink-0" />
                  {record.motivo || "Error de validación estructural"}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border/40 mt-1">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {formatDateTime(record.fecha_ingreso)}
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold gap-1 text-primary">
                Gestionar <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
        
        {filteredData.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
            No se encontraron registros con los filtros aplicados
          </div>
        )}
      </div>
    </div>
  );
}
