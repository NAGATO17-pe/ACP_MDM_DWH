import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EtlRunDetailClient } from "./etl-run-detail-client";

export const metadata: Metadata = { title: "Corrida ETL" };

export default async function EtlRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/etl-monitor"
        className="inline-flex w-fit items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
        Volver al monitor
      </Link>
      <EtlRunDetailClient id={id} />
    </div>
  );
}
