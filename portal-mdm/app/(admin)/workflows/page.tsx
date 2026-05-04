import type { Metadata } from "next";
import { WorkflowsClient } from "./workflows-client";

export const metadata: Metadata = { title: "Workflows de aprobación" };

export default function WorkflowsPage() {
  return <WorkflowsClient />;
}
