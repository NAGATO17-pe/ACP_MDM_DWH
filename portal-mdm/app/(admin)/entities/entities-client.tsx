"use client";

import { EntityTable } from "@/components/entities/entity-table";
import type { MdmEntity } from "@/lib/schemas/entities";

export function EntitiesClient({ data }: { data: MdmEntity[] }) {
  return <EntityTable data={data} />;
}
