import { z } from "zod";

export const qualityKpiSchema = z.object({
  completeness: z.number(),
  validated: z.number(),
  activeErrors: z.number().int(),
  globalScore: z.number(),
  deltas: z.object({
    completeness: z.number(),
    validated: z.number(),
    activeErrors: z.number(),
    globalScore: z.number(),
  }),
});

export const qualityByEntitySchema = z.object({
  entity: z.string(),
  target: z.number(),
  actual: z.number(),
  errors: z.number().int(),
});

export const qualityTrendItemSchema = z.object({
  date: z.string(),
  errors: z.number().int(),
  validated: z.number(),
});

export const qualityRadarItemSchema = z.object({
  metric: z.string(),
  Clientes: z.number(),
  Productos: z.number(),
  Proveedores: z.number(),
  Ubicaciones: z.number(),
});

export const qualityOverviewSchema = z.object({
  kpis: qualityKpiSchema,
  byEntity: z.array(qualityByEntitySchema),
  trend: z.array(qualityTrendItemSchema),
  radar: z.array(qualityRadarItemSchema),
});

export const executiveStrategicSchema = z.object({
  activeInitiatives: z.object({
    total: z.number().int(),
    inPlan: z.number().int(),
    inExecution: z.number().int(),
    inClosure: z.number().int(),
  }),
  areaCoverage: z.object({
    integrated: z.number().int(),
    total: z.number().int(),
  }),
  estimatedAnnualSavingsUsd: z.number(),
  activeEntities: z.number().int(),
  activeEntitiesDeltaPct: z.number(),
  criticalAlerts: z.number().int(),
  criticalAlertsDeltaPct: z.number(),
});

export const executiveOverviewSchema = z.object({
  kpis: qualityKpiSchema,
  byEntity: z.array(qualityByEntitySchema),
  trend: z.array(qualityTrendItemSchema),
  strategic: executiveStrategicSchema,
});

export type QualityKpi = z.infer<typeof qualityKpiSchema>;
export type QualityByEntity = z.infer<typeof qualityByEntitySchema>;
export type QualityTrendItem = z.infer<typeof qualityTrendItemSchema>;
export type QualityRadarItem = z.infer<typeof qualityRadarItemSchema>;
export type QualityOverview = z.infer<typeof qualityOverviewSchema>;
export type ExecutiveStrategic = z.infer<typeof executiveStrategicSchema>;
export type ExecutiveOverview = z.infer<typeof executiveOverviewSchema>;
