"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table/data-table";
import {
  useVariedadesDim,
  useGeografia,
  usePersonal,
} from "@/hooks/use-catalogos";
import type {
  Geografia,
  Personal,
  VariedadDim,
} from "@/lib/schemas/catalogos";
import { formatDate } from "@/lib/format";

const PAGE = { pagina: 1, tamano: 200 };

const VARIEDAD_COLUMNS: ColumnDef<VariedadDim>[] = [
  {
    accessorKey: "idVariedad",
    header: "ID",
    cell: ({ row }) => (
      <span className="font-mono text-xs text-[var(--color-text-muted)]">
        {row.original.idVariedad}
      </span>
    ),
  },
  {
    accessorKey: "nombreVariedad",
    header: "Variedad",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.nombreVariedad ?? "—"}</span>
    ),
  },
  {
    accessorKey: "breeder",
    header: "Breeder",
    cell: ({ row }) => row.original.breeder ?? "—",
  },
  {
    accessorKey: "esActiva",
    header: "Estado",
    cell: ({ row }) => (
      <Badge variant={row.original.esActiva ? "success" : "default"}>
        {row.original.esActiva ? "Activa" : "Inactiva"}
      </Badge>
    ),
  },
  {
    accessorKey: "fechaModificacion",
    header: "Modificada",
    cell: ({ row }) =>
      row.original.fechaModificacion
        ? formatDate(row.original.fechaModificacion)
        : "—",
  },
];

const GEOGRAFIA_COLUMNS: ColumnDef<Geografia>[] = [
  {
    accessorKey: "fundo",
    header: "Fundo",
    cell: ({ row }) => row.original.fundo ?? "—",
  },
  {
    accessorKey: "sector",
    header: "Sector",
    cell: ({ row }) => row.original.sector ?? "—",
  },
  {
    accessorKey: "modulo",
    header: "Módulo",
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.modulo ?? "—"}</span>
    ),
  },
  {
    accessorKey: "turno",
    header: "Turno",
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.turno ?? "—"}</span>
    ),
  },
  {
    accessorKey: "valvula",
    header: "Válvula",
    cell: ({ row }) => row.original.valvula ?? "—",
  },
  {
    accessorKey: "esVigente",
    header: "Vigencia",
    cell: ({ row }) => (
      <Badge variant={row.original.esVigente ? "success" : "default"}>
        {row.original.esVigente ? "Vigente" : "Histórica"}
      </Badge>
    ),
  },
];

const PERSONAL_COLUMNS: ColumnDef<Personal>[] = [
  {
    accessorKey: "dni",
    header: "DNI",
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.dni ?? "—"}</span>
    ),
  },
  {
    accessorKey: "nombreCompleto",
    header: "Nombre",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.nombreCompleto ?? "—"}</span>
    ),
  },
  {
    accessorKey: "rol",
    header: "Rol",
    cell: ({ row }) => row.original.rol ?? "—",
  },
  {
    accessorKey: "pctAsertividad",
    header: "Asertividad",
    cell: ({ row }) =>
      row.original.pctAsertividad != null ? (
        <span className="tabular-nums">
          {row.original.pctAsertividad.toFixed(1)}%
        </span>
      ) : (
        "—"
      ),
  },
  {
    accessorKey: "diasAusentismo",
    header: "Ausentismo (días)",
    cell: ({ row }) => (
      <span className="tabular-nums">{row.original.diasAusentismo ?? "—"}</span>
    ),
  },
];

function TabLoading() {
  return (
    <div className="flex flex-col gap-2 pt-2" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full rounded" />
      ))}
    </div>
  );
}

export function EntitiesClient() {
  const variedades = useVariedadesDim(PAGE);
  const geografia = useGeografia(PAGE);
  const personal = usePersonal(PAGE);

  return (
    <Tabs defaultValue="variedades" className="w-full">
      <TabsList>
        <TabsTrigger value="variedades">Variedades</TabsTrigger>
        <TabsTrigger value="geografia">Geografía</TabsTrigger>
        <TabsTrigger value="personal">Personal</TabsTrigger>
      </TabsList>

      <TabsContent value="variedades">
        {variedades.isLoading && !variedades.data ? (
          <TabLoading />
        ) : (
          <DataTable
            columns={VARIEDAD_COLUMNS}
            data={variedades.data?.datos ?? []}
            searchPlaceholder="Buscar variedad o breeder…"
            emptyMessage="Sin variedades registradas."
          />
        )}
      </TabsContent>

      <TabsContent value="geografia">
        {geografia.isLoading && !geografia.data ? (
          <TabLoading />
        ) : (
          <DataTable
            columns={GEOGRAFIA_COLUMNS}
            data={geografia.data?.datos ?? []}
            searchPlaceholder="Buscar fundo, sector o módulo…"
            emptyMessage="Sin registros de geografía."
          />
        )}
      </TabsContent>

      <TabsContent value="personal">
        {personal.isLoading && !personal.data ? (
          <TabLoading />
        ) : (
          <DataTable
            columns={PERSONAL_COLUMNS}
            data={personal.data?.datos ?? []}
            searchPlaceholder="Buscar por nombre o DNI…"
            emptyMessage="Sin personal registrado."
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
