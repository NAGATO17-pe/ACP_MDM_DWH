import { NextResponse } from "next/server";
import { COOKIE_NAME, cookieOptions } from "@/lib/auth/cookie-config";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", cookieOptions(0));
  return response;
}
