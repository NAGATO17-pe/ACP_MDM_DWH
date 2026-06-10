import type { Metadata } from "next";
import { BitacoraClient } from "./bitacora-client";

export const metadata: Metadata = { title: "Bitácora — Portal MDM" };
export const dynamic = "force-dynamic";

export default function BitacoraPage() {
  return <BitacoraClient />;
}
