export type EntityStatus = "validado" | "pendiente" | "rechazado" | "borrador";
export type EntityType = "cliente" | "producto" | "proveedor" | "ubicacion";

export interface MdmEntity {
  id: string;
  type: EntityType;
  name: string;
  code: string;
  owner: string;
  status: EntityStatus;
  completeness: number; // 0–100
  updatedAt: string; // ISO
}

const NAMES = [
  "Distribuidora Andes S.A.",
  "Agroindustrial Costa Norte",
  "Comercial Pacífico",
  "Inversiones Selva Verde",
  "Lácteos del Sur",
  "Frutas Tropicales SAC",
  "Granos del Altiplano",
  "Procesadora Don Mario",
  "Exportadora Maritima EIRL",
  "Cooperativa Agraria Cusco",
  "Mercados Globales SA",
  "Logística Centro Andina",
  "Empaques del Norte",
  "Insumos Agroquímicos Lima",
  "Cadena Frío Express",
  "Café de Origen Selva",
  "Cereales Premium",
  "Papas Nativas SAC",
  "Bebidas Andinas",
  "Conservas del Mar",
];

const OWNERS = [
  "Carmen Vega",
  "Luis Quispe",
  "Andrea Salas",
  "Daniel Rojas",
  "María Torres",
];

const STATUSES: EntityStatus[] = [
  "validado",
  "pendiente",
  "rechazado",
  "borrador",
];

const TYPES: EntityType[] = ["cliente", "producto", "proveedor", "ubicacion"];

function pseudoRandom(seed: number) {
  // Deterministic PRNG so SSR/CSR stay in sync
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateEntities(count = 60): MdmEntity[] {
  return [];
}

export const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  cliente: "Clientes",
  producto: "Productos",
  proveedor: "Proveedores",
  ubicacion: "Ubicaciones",
};
