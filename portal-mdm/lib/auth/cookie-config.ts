export const COOKIE_NAME = process.env.JWT_COOKIE_NAME ?? "mdm_session";

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}
