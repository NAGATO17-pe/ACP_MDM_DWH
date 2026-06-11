import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/require-role";
import { DwhExplorerClient } from "./dwh-client";

export const metadata: Metadata = { title: "DWH Explorer" };

export default async function DwhPage() {
  await requireRole("admin");
  return <DwhExplorerClient />;
}
