import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers/auth";

/**
 * Smoke tests de las rutas nuevas del admin:
 *   - /bitacora
 *   - /catalogos
 *   - /configuracion
 *
 * Stubean los endpoints `/api/cc/*` con respuestas vacías o mínimas
 * para evitar dependencia del FastAPI real. La intención es verificar
 * que la página renderiza el page header y el shell principal sin
 * errores al cargar — el resto del comportamiento (filtros, mutations,
 * dialogs) lo cubren tests por feature.
 */

const EMPTY_PAGE = { items: [], total: 0, pagina: 1, tamano: 25 };

async function stubAllCc(page: Page): Promise<void> {
  // Catch-all para route handlers de control-center.
  await page.route("**/api/cc/health", (route) =>
    route.fulfill({
      json: {
        etl: "ok",
        dwh: "ok",
        quality: "ok",
        alerts: "ok",
        activeCritical: 0,
        activeWarnings: 0,
        platform: "ok",
        updatedAt: new Date().toISOString(),
      },
    }),
  );

  // Bitácora
  await page.route("**/api/cc/bitacora/list*", (route) =>
    route.fulfill({ json: EMPTY_PAGE }),
  );
  await page.route("**/api/cc/bitacora/resumen*", (route) =>
    route.fulfill({
      json: {
        total: 0,
        ok: 0,
        error: 0,
        enProceso: 0,
        skipped: 0,
        timeout: 0,
        ultimaCorrida: null,
      },
    }),
  );

  // Catálogos
  for (const path of [
    "**/api/cc/catalogos/variedades*",
    "**/api/cc/catalogos/variedades-dim*",
    "**/api/cc/catalogos/geografia*",
    "**/api/cc/catalogos/personal*",
  ]) {
    await page.route(path, (route) => route.fulfill({ json: EMPTY_PAGE }));
  }

  // Configuración
  await page.route("**/api/cc/configuracion/perfil", (route) =>
    route.fulfill({
      json: {
        nombreUsuario: "admin",
        nombreDisplay: "Admin de prueba",
        email: "admin@example.com",
        rol: "admin",
      },
    }),
  );
  await page.route("**/api/cc/configuracion/parametros*", (route) =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );
  await page.route("**/api/cc/configuracion/reglas*", (route) =>
    route.fulfill({
      json: { items: [], total: 0, activas: 0, inactivas: 0 },
    }),
  );
  await page.route("**/api/cc/configuracion/usuarios*", (route) =>
    route.fulfill({ json: [] }),
  );
}

test.describe("Rutas admin — smoke", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin", "Carmen Hernández");
    await stubAllCc(page);
  });

  test("/bitacora renderiza page header", async ({ page }) => {
    await page.goto("/bitacora");
    await expect(
      page.getByRole("heading", { name: /^Bitácora$/i, level: 1 }),
    ).toBeVisible();
  });

  test("/catalogos renderiza page header y descripción", async ({ page }) => {
    await page.goto("/catalogos");
    await expect(
      page.getByRole("heading", { name: /^Catálogos$/i, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByText(/variedades homologadas/i),
    ).toBeVisible();
  });

  test("/configuracion renderiza page header", async ({ page }) => {
    await page.goto("/configuracion");
    await expect(
      page.getByRole("heading", { name: /^Configuración$/i, level: 1 }),
    ).toBeVisible();
  });

  test("/configuracion muestra la card Mi perfil (cualquier rol)", async ({
    page,
  }) => {
    await page.goto("/configuracion");
    await expect(page.getByText(/mi perfil/i).first()).toBeVisible();
  });

  test("/configuracion muestra la card Preferencias (cualquier rol)", async ({
    page,
  }) => {
    await page.goto("/configuracion");
    await expect(
      page.getByText(/preferencias del portal/i).first(),
    ).toBeVisible();
  });
});
