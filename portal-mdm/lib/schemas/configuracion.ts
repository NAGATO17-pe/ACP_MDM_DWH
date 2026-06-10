import { z } from "zod";

/**
 * Contratos del módulo Configuración.
 *
 * - `FastApi*` describen las respuestas crudas del backend (snake_case).
 * - Los schemas sin prefijo son el contrato del portal hacia el cliente
 *   (camelCase, ya legibles).
 *
 * Los route handlers `/api/cc/configuracion/*` mapean upstream → downstream.
 */

/* -------------------------------------------------------------------------- */
/* Roles                                                                      */
/* -------------------------------------------------------------------------- */

export const BackendRol = z.enum([
  "admin",
  "operador_etl",
  "analista_mdm",
  "viewer",
]);
export type BackendRol = z.infer<typeof BackendRol>;

const NIVEL: Record<BackendRol, number> = {
  viewer: 10,
  operador_etl: 15,
  analista_mdm: 20,
  admin: 40,
};

export function tieneRolMinimo(rol: BackendRol, requerido: BackendRol): boolean {
  return NIVEL[rol] >= NIVEL[requerido];
}

export const ROL_LABEL: Record<BackendRol, string> = {
  admin: "Administrador",
  operador_etl: "Operador ETL",
  analista_mdm: "Analista MDM",
  viewer: "Solo lectura",
};

/* -------------------------------------------------------------------------- */
/* Perfil                                                                     */
/* -------------------------------------------------------------------------- */

export const FastApiPerfil = z.object({
  nombre_usuario: z.string(),
  nombre_display: z.string(),
  rol: z.string(),
  email: z.string().nullable().optional(),
});

export const Perfil = z.object({
  nombreUsuario: z.string(),
  nombreDisplay: z.string(),
  rol: BackendRol,
  email: z.string().nullable(),
});
export type Perfil = z.infer<typeof Perfil>;

export function mapPerfil(raw: z.infer<typeof FastApiPerfil>): Perfil {
  const rolValidado = BackendRol.safeParse(raw.rol);
  return {
    nombreUsuario: raw.nombre_usuario,
    nombreDisplay: raw.nombre_display,
    rol: rolValidado.success ? rolValidado.data : "viewer",
    email: raw.email ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Cambio de contraseña                                                       */
/* -------------------------------------------------------------------------- */

export const CambiarClaveInput = z
  .object({
    claveActual: z.string().min(1, "Ingresa tu contraseña actual").max(200),
    claveNueva: z
      .string()
      .min(8, "Mínimo 8 caracteres")
      .max(200, "Máximo 200 caracteres"),
    claveConfirmar: z.string().min(1, "Confirma la nueva contraseña"),
  })
  .refine((d) => d.claveNueva === d.claveConfirmar, {
    message: "Las contraseñas no coinciden",
    path: ["claveConfirmar"],
  })
  .refine((d) => d.claveNueva !== d.claveActual, {
    message: "La nueva contraseña debe ser distinta",
    path: ["claveNueva"],
  });
export type CambiarClaveInput = z.infer<typeof CambiarClaveInput>;

export const FastApiMensaje = z.object({
  mensaje: z.string(),
  ok: z.boolean().optional().default(true),
});

/* -------------------------------------------------------------------------- */
/* Parámetros del pipeline                                                    */
/* -------------------------------------------------------------------------- */

export const FastApiParametro = z.object({
  nombre_parametro: z.string(),
  valor: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  fecha_modificacion: z.string().nullable().optional(),
});

export const FastApiParametrosPagina = z.object({
  total: z.number().int().nonnegative(),
  pagina: z.number().int().positive(),
  tamano: z.number().int().positive(),
  datos: z.array(FastApiParametro),
});

export const Parametro = z.object({
  nombre: z.string(),
  valor: z.string(),
  descripcion: z.string().nullable(),
  fechaModificacion: z.string().nullable(),
});
export type Parametro = z.infer<typeof Parametro>;

export const ParametrosPagina = z.object({
  total: z.number().int().nonnegative(),
  pagina: z.number().int().positive(),
  tamano: z.number().int().positive(),
  datos: z.array(Parametro),
});
export type ParametrosPagina = z.infer<typeof ParametrosPagina>;

export function mapParametro(raw: z.infer<typeof FastApiParametro>): Parametro {
  return {
    nombre: raw.nombre_parametro,
    valor: raw.valor ?? "",
    descripcion: raw.descripcion ?? null,
    fechaModificacion: raw.fecha_modificacion ?? null,
  };
}

export const ActualizarParametroInput = z.object({
  valor: z.string().min(1, "El valor no puede estar vacío").max(500),
});

/* -------------------------------------------------------------------------- */
/* Reglas de validación                                                        */
/* -------------------------------------------------------------------------- */

export const FastApiRegla = z.object({
  tabla_destino: z.string().nullable().optional(),
  columna: z.string().nullable().optional(),
  tipo_validacion: z.string().nullable().optional(),
  valor_min: z.number().nullable().optional(),
  valor_max: z.number().nullable().optional(),
  accion: z.string().nullable().optional(),
  activo: z.boolean(),
});

export const FastApiReglasPagina = z.object({
  total: z.number().int().nonnegative(),
  pagina: z.number().int().positive(),
  tamano: z.number().int().positive(),
  kpis: z.object({
    total: z.number().int().nonnegative(),
    activas: z.number().int().nonnegative(),
    inactivas: z.number().int().nonnegative(),
  }),
  datos: z.array(FastApiRegla),
});

export const Regla = z.object({
  tablaDestino: z.string().nullable(),
  columna: z.string().nullable(),
  tipoValidacion: z.string().nullable(),
  valorMin: z.number().nullable(),
  valorMax: z.number().nullable(),
  accion: z.string().nullable(),
  activa: z.boolean(),
});
export type Regla = z.infer<typeof Regla>;

export const ReglasPagina = z.object({
  total: z.number().int().nonnegative(),
  pagina: z.number().int().positive(),
  tamano: z.number().int().positive(),
  kpis: z.object({
    total: z.number().int().nonnegative(),
    activas: z.number().int().nonnegative(),
    inactivas: z.number().int().nonnegative(),
  }),
  datos: z.array(Regla),
});
export type ReglasPagina = z.infer<typeof ReglasPagina>;

export function mapRegla(raw: z.infer<typeof FastApiRegla>): Regla {
  return {
    tablaDestino: raw.tabla_destino ?? null,
    columna: raw.columna ?? null,
    tipoValidacion: raw.tipo_validacion ?? null,
    valorMin: raw.valor_min ?? null,
    valorMax: raw.valor_max ?? null,
    accion: raw.accion ?? null,
    activa: raw.activo,
  };
}

/* -------------------------------------------------------------------------- */
/* Usuarios (admin)                                                           */
/* -------------------------------------------------------------------------- */

export const FastApiUsuario = z.object({
  id_usuario: z.number().int(),
  nombre_usuario: z.string(),
  nombre_display: z.string(),
  email: z.string().nullable().optional(),
  rol: z.string(),
  es_activo: z.boolean(),
  fecha_creacion: z.string().nullable().optional(),
  ultimo_acceso: z.string().nullable().optional(),
});

export const Usuario = z.object({
  idUsuario: z.number().int(),
  nombreUsuario: z.string(),
  nombreDisplay: z.string(),
  email: z.string().nullable(),
  rol: BackendRol,
  esActivo: z.boolean(),
  fechaCreacion: z.string().nullable(),
  ultimoAcceso: z.string().nullable(),
});
export type Usuario = z.infer<typeof Usuario>;

export function mapUsuario(raw: z.infer<typeof FastApiUsuario>): Usuario {
  const rolValidado = BackendRol.safeParse(raw.rol);
  return {
    idUsuario: raw.id_usuario,
    nombreUsuario: raw.nombre_usuario,
    nombreDisplay: raw.nombre_display,
    email: raw.email ?? null,
    rol: rolValidado.success ? rolValidado.data : "viewer",
    esActivo: raw.es_activo,
    fechaCreacion: raw.fecha_creacion ?? null,
    ultimoAcceso: raw.ultimo_acceso ?? null,
  };
}

export const CrearUsuarioInput = z.object({
  nombreUsuario: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres")
    .max(100, "Máximo 100 caracteres")
    .regex(/^[a-zA-Z0-9._-]+$/, "Solo letras, números, punto, guión y guión bajo"),
  nombreDisplay: z
    .string()
    .trim()
    .min(1, "Requerido")
    .max(200, "Máximo 200 caracteres"),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(200)
    .optional()
    .or(z.literal("")),
  clave: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .max(200, "Máximo 200 caracteres"),
  rol: BackendRol,
});
export type CrearUsuarioInput = z.infer<typeof CrearUsuarioInput>;
