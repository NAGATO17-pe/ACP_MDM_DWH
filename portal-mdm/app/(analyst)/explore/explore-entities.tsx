"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityTable } from "@/components/entities/entity-table";
import type { MdmEntityFromApi as MdmEntity } from "@/lib/schemas/entities";

export function ExploreEntities({ data }: { data: MdmEntity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Entidades maestras</CardTitle>
        <CardDescription>
          Exploración de entidades del data warehouse. Filtra por tipo o busca por nombre y código.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EntityTable data={data} readOnly />
      </CardContent>
    </Card>
  );
}
