import { test, expect, type BrowserContext } from "@playwright/test";

/**
 * Regresión de escalada de privilegios.
 *
 * Bug histórico (proxy.ts:32, session.ts:54): cualquier rol del JWT que el
 * frontend no reconocía caía a un fallback `?? "admin"` (fail-OPEN). Como el
 * backend FastAPI emite roles distintos a los del frontend (viewer,
 * operador_etl, analista_mdm vs analyst/admin/executive), un usuario de
 * "solo lectura" terminaba con permisos de administrador en silencio, y un
 * atacante forjando un rol arbitrario obtenía lo mismo.
 *
 * Estas pruebas exigen FAIL-CLOSED en ambos casos.
 */

const COOKIE_NAME = process.env.JWT_COOKIE_NAME ?? "mdm_session";

function jwtWithRole(role: string): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    sub: "test-user",
    role,
    name: "Test",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  return `${header}.${payload}.test-sig`;
}

async function setSessionCookie(context: BrowserContext, role: string) {
  await context.addCookies([
    {
      name: COOKIE_NAME,
      value: jwtWithRole(role),
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

test.describe("RBAC: fail-closed contra escalada de privilegios", () => {
  test("rol backend 'viewer' NO puede entrar a /dashboard (ruta admin)", async ({
    page,
    context,
  }) => {
    await setSessionCookie(context, "viewer");
    await page.goto("/dashboard");
    await expect(page).not.toHaveURL(/\/dashboard(\/|$|\?)/);
  });

  test("rol desconocido es rechazado (redirect a /login)", async ({
    page,
    context,
  }) => {
    await setSessionCookie(context, "rol_inventado_por_atacante");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("JWT sin claim de rol es rechazado (redirect a /login)", async ({
    page,
    context,
  }) => {
    // Token válido en forma pero sin 'role' ni 'rol'.
    const b64 = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString("base64url");
    const h = b64({ alg: "HS256", typ: "JWT" });
    const p = b64({
      sub: "test",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    await context.addCookies([
      {
        name: COOKIE_NAME,
        value: `${h}.${p}.sig`,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("rol 'admin' válido SÍ puede entrar a /dashboard (no regresión)", async ({
    page,
    context,
  }) => {
    await setSessionCookie(context, "admin");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
