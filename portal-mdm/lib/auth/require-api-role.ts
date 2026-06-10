import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "./session";
import type { Role } from "./rbac";

type ApiGuardResult =
  | { error: null; session: SessionPayload }
  | { error: NextResponse; session: null };

/**
 * Guard para route handlers: verifica sesión válida.
 * Para rutas accesibles a cualquier rol autenticado.
 */
export async function requireApiSession(): Promise<ApiGuardResult> {
  const session = await getSession();
  if (!session) {
    return {
      error: NextResponse.json({ detail: "No autorizado" }, { status: 401 }),
      session: null,
    };
  }
  return { error: null, session };
}

/**
 * Guard para route handlers: verifica sesión Y rol mínimo requerido.
 * Admin siempre pasa (bypass intencional para fase actual).
 * Para rutas admin-only: usar requireApiRole("admin").
 */
export async function requireApiRole(required: Role): Promise<ApiGuardResult> {
  const session = await getSession();
  if (!session) {
    return {
      error: NextResponse.json({ detail: "No autorizado" }, { status: 401 }),
      session: null,
    };
  }
  if (session.role !== "admin" && session.role !== required) {
    return {
      error: NextResponse.json({ detail: "Acceso denegado" }, { status: 403 }),
      session: null,
    };
  }
  return { error: null, session };
}
