import { cookies } from "next/headers";
import { jwtVerify, decodeJwt } from "jose";
import type { Role } from "./rbac";
import { parseRole } from "./roles";

export const JWT_COOKIE_NAME = process.env.JWT_COOKIE_NAME ?? "mdm_session";

export interface SessionPayload {
  sub: string;
  role: Role;
  name?: string;
  username?: string;
  exp?: number;
}

/**
 * Server-side session reader. Validates the JWT signature when
 * `JWT_PUBLIC_SECRET` is configured; otherwise decodes without verifying
 * (dev only — set ALLOW_UNSIGNED_JWT=1 to allow this in non-production).
 */
export async function getSession(): Promise<SessionPayload | null> {
  const secret = process.env.JWT_PUBLIC_SECRET;

  if (!secret) {
    if (
      process.env.NODE_ENV === "production" &&
      !process.env.ALLOW_UNSIGNED_JWT
    ) {
      // Fail-closed: never accept unsigned JWTs in production.
      throw new Error(
        "JWT_PUBLIC_SECRET must be set in production. " +
          "Set ALLOW_UNSIGNED_JWT=1 only for trusted dev environments.",
      );
    }
  }

  const store = await cookies();
  const token = store.get(JWT_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const claims = secret
      ? (
          await jwtVerify(token, new TextEncoder().encode(secret), {
            algorithms: ["HS256", "HS512"],
          })
        ).payload
      : decodeJwt(token);

    // parseRole is fail-closed: returns null for unknown/missing roles.
    const role = parseRole(claims as Record<string, unknown>);
    if (!role) return null;

    const name =
      typeof claims.display === "string"
        ? claims.display
        : typeof claims.name === "string"
          ? claims.name
          : undefined;

    return {
      sub: String(claims.sub ?? ""),
      role,
      name,
      username:
        typeof claims.username === "string"
          ? claims.username
          : String(claims.sub ?? ""),
      exp: typeof claims.exp === "number" ? claims.exp : undefined,
    };
  } catch {
    return null;
  }
}
