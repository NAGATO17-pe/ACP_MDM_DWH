import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const SEMANAL = [1, 2, 3, 4, 5, 6].map((w) => ({
  semana: w,
  semana_label: `W${w} (0${w}/07)`,
  fecha_semana: `2026-07-0${w}`,
  kg_proyectados: 1000 * w,
  kg_pesimista: 990 * w,
  kg_optimista: 1010 * w,
  kg_anterior: 0,
  pct_variacion: 0,
  tendencia: "Estable",
}));

function stubProyecciones(page: Page): void {
  void page.route("**/api/cc/proyecciones/fechas", (r) =>
    r.fulfill({ json: { fechas: [20260610, 20260603] } }),
  );
  void page.route("**/api/cc/proyecciones/combinaciones/**", (r) =>
    r.fulfill({
      json: [
        {
          Fundo: "Fundo Norte",
          Modulo: "1",
          Variedad: "Sekoya Pop",
          Condicion: "Suelo - Organico",
        },
      ],
    }),
  );
  void page.route("**/api/cc/proyecciones/matriz", (r) => {
    if (r.request().method() === "POST") return r.fulfill({ json: { ok: true } });
    return r.fulfill({ json: {} });
  });
  void page.route("**/api/cc/proyecciones/ejecutar", (r) =>
    r.fulfill({
      json: {
        df_semanal: SEMANAL,
        kpis: {
          total_base: 21000,
          total_opt: 21210,
          total_pes: 20790,
          variedad_top: "Sekoya Pop",
          total_plantas: 15000,
          kg_por_planta: 1.4,
          unidades_cubiertas: 10,
          unidades_totales: 12,
        },
        df_detalle: [],
      },
    }),
  );
  void page.route("**/api/cc/**", (r) => r.fulfill({ json: {} }));
}

test.describe("Proyecciones — analyst", () => {
  test.beforeEach(async ({ page }) => {
    stubProyecciones(page);
    await loginAs(page, "analyst");
  });

  test("analyst llega a /proyecciones y ve filtros + CTA", async ({ page }) => {
    await page.goto("/proyecciones");
    await expect(page).toHaveURL("/proyecciones");
    await expect(
      page.getByRole("heading", { name: /proyecciones de cosecha/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /proyectar/i }),
    ).toBeVisible();
  });

  test("ejecutar proyeccion muestra KPIs y chart", async ({ page }) => {
    await page.goto("/proyecciones");
    await page.getByRole("button", { name: /proyectar/i }).click();
    await expect(
      page.getByText(/kg proyectados \(central\)/i),
    ).toBeVisible();
    await expect(page.getByText(/21[,\s.]?000/)).toBeVisible();
    await expect(
      page.getByText(/kg proyectados por semana/i),
    ).toBeVisible();
  });

  test("editor de matriz abre y muestra celdas AUTO", async ({ page }) => {
    await page.goto("/proyecciones");
    await page
      .getByRole("button", { name: /configuración avanzada/i })
      .click();
    await expect(page.getByText(/restaurar defaults/i)).toBeVisible();
    await expect(page.getByText("auto").first()).toBeVisible();
  });
});

test.describe("Proyecciones — RBAC", () => {
  test("executive NO llega a /proyecciones", async ({ page }) => {
    stubProyecciones(page);
    await loginAs(page, "executive");
    await page.goto("/proyecciones");
    await expect(page).not.toHaveURL("/proyecciones");
  });
});
