import type { Metadata } from "next";
import { AuditClient } from "./audit-client";

export const metadata: Metadata = { title: "Auditoría" };

export default function AuditPage() {
  return <AuditClient />;
}
