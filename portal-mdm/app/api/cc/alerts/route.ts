import { NextResponse } from "next/server";
import { computeAlerts } from "@/lib/control-center/compute-alerts";

export const dynamic = "force-dynamic";

export async function GET() {
  const alerts = await computeAlerts();
  return NextResponse.json(alerts, {
    headers: {
      "cache-control": "private, max-age=10, stale-while-revalidate=20",
    },
  });
}
