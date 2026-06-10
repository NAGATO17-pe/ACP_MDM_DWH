import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "./session";
import { ROLE_HOME, type Role } from "./rbac";

export async function requireRole(expected: Role): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== expected) redirect(ROLE_HOME[session.role]);
  return session;
}

export async function requireAnyRole(required: readonly Role[]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!required.includes(session.role)) redirect(ROLE_HOME[session.role]);
  return session;
}
