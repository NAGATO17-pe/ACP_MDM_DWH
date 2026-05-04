export type ModelStatus = "produccion" | "staging" | "archivado";

export interface PredictiveModel {
  id: string;
  name: string;
  algorithm: string;
  target: string;
  accuracy: number;
  auc: number;
  f1: number;
  status: ModelStatus;
  trainedAt: string;
  predictions24h: number;
}

export const MODELS: PredictiveModel[] = [];

export const MODEL_STATUS_LABEL: Record<ModelStatus, string> = {
  produccion: "Producción",
  staging: "Staging",
  archivado: "Archivado",
};
