import { NextResponse } from "next/server";

import {
  loginResponseSchema,
  loginSchema,
  type LoginResponse,
} from "@/lib/schemas/auth";
import { COOKIE_NAME, cookieOptions } from "@/lib/auth/cookie-config";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { detail: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  try {
    const formData = new URLSearchParams();
    formData.append("username", parsed.data.username);
    formData.append("password", parsed.data.password);

    const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const apiRes = await fetch(`${backendUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: formData,
    });

    const data = await apiRes.json();

    if (!apiRes.ok) {
      if (apiRes.status === 401 || apiRes.status === 403) {
        return NextResponse.json({ detail: "Credenciales inválidas" }, { status: 401 });
      }
      if (apiRes.status === 422) {
        return NextResponse.json({ detail: data.detail ?? "Datos rechazados por el servidor (422)" }, { status: 422 });
      }
      throw new Error("Error del servidor");
    }

    const tokenData = loginResponseSchema.parse(data);

    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE_NAME, tokenData.access_token, cookieOptions(60 * 60 * 8));
    return response;
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { detail: "Error inesperado al iniciar sesión" },
      { status: 500 },
    );
  }
}
