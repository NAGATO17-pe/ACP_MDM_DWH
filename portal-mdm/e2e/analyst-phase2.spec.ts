import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers/auth";

function stubSharedRoutes(page: Page): void {
  void page.route("**/api/cc/quality/summary", (r) =>
    r.fulfill({
      json: {
        total: 10,
        pendientes: 3,
        resueltos: 5,
        descartados: 2,
        resolutionRate: 70,
      },
    }),
  );
  void page.route("**/api/cc/quality**", (r) =>
    r.fulfill({ json: { datos: [], total: 0, pagina: 1, tamano: 25 } }),
  );
  void page.route("**/api/cc/workflows/homologation**", (r) =>
    r.fulfill({ json: [] }),
  );
  void page.route("**/api/cc/reinyeccion**", (r) =>
    r.fulfill({ json: { candidatos: 0 } }),
  );
  void page.route("**/api/cc/catalogos/**", (r) =>
    r.fulfill({ json: { datos: [], total: 0, pagina: 1, tamano: 50 } }),
  );
  void page.route("**/api/cc/**", (r) =>
    r.fulfill({ json: {} }),
  );
}

test.describe("Analyst Phase 2 — shared pages read-only", () => {
  test.beforeEach(async ({ page }) => {
    stubSharedRoutes(page);
    await loginAs(page, "analyst");
  });

  test("analyst can reach /quality and sees no bulk action bar", async ({ page }) => {
    await page.goto("/quality");
    await expect(page).not.toHaveURL("/home");
    await expect(
      page.getByRole("heading", { name: /calidad/i }),
    ).toBeVisible();
    // QuarantineBulkBar only renders when selected.length > 0 — with empty
    // data the region never mounts, so no bulk buttons are visible.
    await expect(
      page.getByRole("button", { name: /guardar seleccionados/i }),
    ).not.toBeVisible();
  });

  test("analyst can reach /workflows and sees no save/reject buttons", async ({ page }) => {
    await page.goto("/workflows");
    await expect(page).not.toHaveURL("/home");
    await expect(
      page.getByRole("heading", { name: /homolog/i }),
    ).toBeVisible();
    // isReadOnly=true hides the action toolbar in HomologationClient
    await expect(
      page.getByRole("button", { name: /guardar seleccionados/i }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: /ejecutar reprocesamiento/i }),
    ).not.toBeVisible();
  });

  test("analyst can reach /catalogos and sees no nueva variedad button", async ({ page }) => {
    await page.goto("/catalogos");
    await expect(page).not.toHaveURL("/home");
    await expect(
      page.getByRole("heading", { name: /catálogos/i }),
    ).toBeVisible();
    // NuevaVariedadDialog only renders when !isReadOnly
    await expect(
      page.getByRole("button", { name: /nueva variedad/i }),
    ).not.toBeVisible();
  });

  test("analyst sees analyst sidebar nav on /workflows (not admin nav)", async ({ page }) => {
    await page.goto("/workflows");
    // Analyst nav has "Mi Workspace" (home route label)
    await expect(
      page.getByRole("link", { name: /mi workspace/i }),
    ).toBeVisible();
    // Admin-only "Dashboard" link must not appear
    await expect(
      page.getByRole("link", { name: /^dashboard$/i }),
    ).not.toBeVisible();
  });

  test("analyst cannot reach admin-only /dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).not.toHaveURL("/dashboard");
  });
});

test.describe("Admin still has full write access on shared pages", () => {
  test.beforeEach(async ({ page }) => {
    stubSharedRoutes(page);
    await loginAs(page, "admin");
  });

  test("admin sees save/reject buttons on /workflows", async ({ page }) => {
    await page.goto("/workflows");
    await expect(
      page.getByRole("button", { name: /guardar seleccionados/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /rechazar/i }),
    ).toBeVisible();
  });

  test("admin sees nueva variedad button on /catalogos", async ({ page }) => {
    await page.goto("/catalogos");
    await expect(
      page.getByRole("button", { name: /nueva variedad/i }),
    ).toBeVisible();
  });
});
