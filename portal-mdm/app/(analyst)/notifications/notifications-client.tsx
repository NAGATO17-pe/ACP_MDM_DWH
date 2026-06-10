"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";

interface NotificacionItem {
  id: string;
  tipo: "etl_failure" | "cuarentena" | "umbral_calidad" | "etl_ok" | "info";
  severidad: "error" | "warning" | "info";
  titulo: string;
  descripcion: string;
  timestamp: string;
  leida: boolean;
  link?: string | null;
}

interface NotificacionesResponse {
  items: NotificacionItem[];
  total: number;
  no_leidas: number;
}

const SEVERIDAD_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERIDAD_COLOR: Record<string, string> = {
  error: "text-destructive",
  warning: "text-yellow-500",
  info: "text-blue-400",
};

const TIPO_LABEL: Record<string, string> = {
  etl_failure: "ETL Failure",
  cuarentena: "Cuarentena",
  umbral_calidad: "Umbral calidad",
  etl_ok: "ETL OK",
  info: "Info",
};

export function NotificationsClient() {
  const [severidad, setSeveridad] = useState<string>("");

  const { data, isLoading, refetch, isFetching } = useQuery<NotificacionesResponse>({
    queryKey: ["analyst", "notifications", severidad],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", page_size: "50" });
      if (severidad) params.set("severidad", severidad);
      const res = await fetch(`/api/analyst/notifications?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Error cargando notificaciones");
      return res.json();
    },
    refetchInterval: 30_000,
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notificaciones</h1>
          {data && data.no_leidas > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">{data.no_leidas} sin leer</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={severidad} onValueChange={setSeveridad}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              <SelectItem value="error">Solo errores</SelectItem>
              <SelectItem value="warning">Solo warnings</SelectItem>
              <SelectItem value="info">Solo info</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Actualizar notificaciones"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
          <CheckCircle2 className="h-8 w-8 opacity-30" />
          <p className="text-sm">Sin notificaciones</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.items.map((n) => {
            const Icon = SEVERIDAD_ICON[n.severidad] ?? Info;
            return (
              <div
                key={n.id}
                className={cn(
                  "flex gap-3 p-4 rounded-xl border transition-colors",
                  !n.leida
                    ? "bg-muted/40 border-border"
                    : "bg-background border-border/50 opacity-70",
                )}
              >
                <Icon
                  className={cn("h-5 w-5 mt-0.5 shrink-0", SEVERIDAD_COLOR[n.severidad])}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-semibold">{n.titulo}</span>
                    <Badge variant="outline" className="text-xs">
                      {TIPO_LABEL[n.tipo] ?? n.tipo}
                    </Badge>
                    {!n.leida && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{n.descripcion}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {formatDateTime(n.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
