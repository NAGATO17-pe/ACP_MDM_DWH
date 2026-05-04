"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityTable } from "@/components/entities/entity-table";
import type { MdmEntityFromApi as MdmEntity } from "@/lib/schemas/entities";

export function EntitiesClient({ data }: { data: MdmEntity[] }) {
  return (
    <EntityTable
      data={data}
      headerSlot={
        <Button>
          <Plus aria-hidden className="h-4 w-4" />
          Nueva entidad
        </Button>
      }
    />
  );
}
