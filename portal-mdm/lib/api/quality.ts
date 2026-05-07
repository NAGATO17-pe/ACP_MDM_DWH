import { apiFetch } from "./client";
import {
  executiveOverviewSchema,
  qualityOverviewSchema,
  type ExecutiveOverview,
  type QualityOverview,
} from "@/lib/schemas/quality";

export async function getQualityOverview(): Promise<QualityOverview> {
  const raw = await apiFetch<unknown>("/api/v1/quality/overview");
  return qualityOverviewSchema.parse(raw);
}

export async function getExecutiveOverview(): Promise<ExecutiveOverview> {
  const raw = await apiFetch<unknown>("/api/v1/quality/executive");
  return executiveOverviewSchema.parse(raw);
}
