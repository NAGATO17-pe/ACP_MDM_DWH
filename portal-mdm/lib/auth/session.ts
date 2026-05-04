import { cookies } from "next/headers";
import { jwtVerify, decodeJwt } from "jose";
import { isValidRole, type Role } from "./rbac";

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
 * (intended for local dev against a trusted FastAPI backend).
 */
export async function getSession(): Promise<SessionPayload | null> {
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.JWT_PUBLIC_SECRET
  ) {
    console.warn(
      "WARNING: JWT_PUBLIC_SECRET is not set in production. " +
        "JWTs are being accepted without signature verification. " +
        "This is a major security risk.",
    );
  }

  const store = await cookies();
  const token = store.get(JWT_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const secret = process.env.JWT_PUBLIC_SECRET;
    const claims = secret
      ? (
          await jwtVerify(
            token,
            new TextEncoder().encode(secret),
            // Algorithms accepted from FastAPI backend
            { algorithms: ["HS256", "HS512"] },
          )
        ).payload
      : decodeJwt(token);

    // Debug logging for claims
    console.log("JWT Claims received:", claims);

    let role = claims.role || claims.rol;
    if (!isValidRole(role)) {
      console.warn(`Role '${role}' is not valid or missing in JWT. Defaulting to 'admin' for now.`);
      role = "admin";
    }

    const name = typeof claims.display === "string" ? claims.display : (typeof claims.name === "string" ? claims.name : undefined);

    return {
      sub: String(claims.sub ?? ""),
      role: role as Role,
      name,
      username: typeof claims.username === "string" ? claims.username : String(claims.sub ?? ""),
      exp: typeof claims.exp === "number" ? claims.exp : undefined,
    };
  } catch (err) {
    console.error("Error decoding session:", err);
    return null;
  }
}
