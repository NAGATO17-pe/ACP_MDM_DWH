import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/require-role";
import { BitacoraClient } from "./bitacora-client";

export const metadata: Metadata = { title: "Bitácora — Portal MDM" };
export const dynamic = "force-dynamic";

export default async function BitacoraPage() {
  await requireRole("admin");
  return <BitacoraClient />;
}
