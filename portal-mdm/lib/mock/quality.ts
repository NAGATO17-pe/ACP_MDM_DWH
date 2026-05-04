export interface QualityKpi {
  completeness: number;
  validated: number;
  activeErrors: number;
  globalScore: number;
  deltas: {
    completeness: number;
    validated: number;
    activeErrors: number;
    globalScore: number;
  };
}

export const QUALITY_KPIS: QualityKpi = {
  completeness: 0,
  validated: 0,
  activeErrors: 0,
  globalScore: 0,
  deltas: {
    completeness: 0,
    validated: 0,
    activeErrors: 0,
    globalScore: 0,
  },
};

export interface QualityByEntity {
  entity: string;
  target: number;
  actual: number;
  errors: number;
}

export const QUALITY_BY_ENTITY: QualityByEntity[] = [];

export interface QualityTrend {
  date: string;
  errors: number;
  validated: number;
}

export const QUALITY_TREND: QualityTrend[] = [];

export interface QualityRadarItem {
  metric: string;
  Clientes: number;
  Productos: number;
  Proveedores: number;
  Ubicaciones: number;
}

export const QUALITY_RADAR: QualityRadarItem[] = [];
