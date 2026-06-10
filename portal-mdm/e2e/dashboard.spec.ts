import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers/auth";

/**
 * Smoke tests del Dashboard (/dashboard).
 *
 * Estos tests stubean los endpoints `/api/cc/*` con fixtures
 * deterministas para no depender de un FastAPI real. La intención es
 * verificar que el shell del dashboard renderiza correctamente —
 * Hero KPIs, cards, click-through y border tonal según el estado.
 *
 * Los stubs cubren TANTO el prefetch server-side del HydrationBoundary
 * (request server-to-server con cookie) como el refetch client-side
 * subsiguiente. Playwright intercepta ambos porque comparten URL.
 */

const HEALTH_OK = {
  etl: "ok",
  dwh: "ok",
  quality: "warning",
  alerts: "warning",
  activeCritical: 0,
  activeWarnings: 1,
  platform: "warning",
  updatedAt: new Date().toISOString(),
};

const DWH_STATE = {
  tables: 12,
  rowsLast24h: 145_232,
  rejectedLast24h: 18,
  failedLast24h: 0,
  lastSuccessAt: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
};

const QUALITY_KPIS = {
  total: 240,
  pendientes: 8,
  resueltos: 220,
  descartados: 12,
  resolutionRate: 96.7,
};

const ETL_TREND = Array.from({ length: 14 }, (_, i) => ({
  date: `12-${String(i + 1).padStart(2, "0")}`,
  success: 10 + i,
  failed: i === 13 ? 2 : i === 12 ? 1 : 0,
}));

const ALERTS = [
  {
    id: "alert-1",
    severity: "warning",
    source: "Calidad",
    message: "8 registros pendientes en cuarentena",
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    acknowledged: false,
    ackedBy: null,
    ackedAt: null,
    ackComment: null,
  },
];

const ACTIVITY = [
  {
    id: "log-101",
    at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    actor: null,
    kind: "etl",
    message: "Fact_Cosecha_SAP → OK · 32k filas",
  },
];

async function stubControlCenter(page: Page): Promise<void> {
  await page.route("**/api/cc/health", (route) =>
    route.fulfill({ json: HEALTH_OK }),
  );
  await page.route("**/api/cc/dwh", (route) =>
    route.fulfill({ json: DWH_STATE }),
  );
  await page.route("**/api/cc/quality", (route) =>
    route.fulfill({ json: QUALITY_KPIS }),
  );
  await page.route("**/api/cc/etl/trend*", (route) =>
    route.fulfill({ json: ETL_TREND }),
  );
  await page.route("**/api/cc/alerts", (route) =>
    route.fulfill({ json: ALERTS }),
  );
  await page.route("**/api/cc/activity*", (route) =>
    route.fulfill({ json: ACTIVITY }),
  );
}

test.describe("Dashboard admin", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "admin", "Carmen Hernández");
    await stubControlCenter(page);
  });

  test("renderiza el page header y el indicador de auto-refresh", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /^Dashboard$/, level: 1 }),
    ).toBeVisible();
    // V4: LastSyncBadge muestra "Actualizado ..." o "Actualizando..."
    await expect(
      page
        .getByText(/Actualizado|Actualizando/i)
        .first(),
    ).toBeVisible();
  });

  test("V1: muestra los 4 KPIs del hero con labels correctos", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    const hero = page.getByRole("region", { name: /indicadores clave/i });
    await expect(hero).toBeVisible();
    await expect(hero.getByText(/filas insertadas 24 h/i)).toBeVisible();
    await expect(hero.getByText(/fallos etl 24 h/i)).toBeVisible();
    await expect(hero.getByText(/pendientes en cuarentena/i)).toBeVisible();
    await expect(hero.getByText(/alertas críticas activas/i)).toBeVisible();
  });

  test("V1: el KPI de filas muestra el número formateado del fixture", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    const hero = page.getByRole("region", { name: /indicadores clave/i });
    // formatNumber(145232) usa locale es: "145.232" o "145,232"
    await expect(hero.getByText(/145[\.,]232/)).toBeVisible();
  });

  test("V3: KPI hero es link al detalle correspondiente", async ({ page }) => {
    await page.goto("/dashboard");
    const kpiFallos = page.getByRole("link", {
      name: /fallos etl 24 h/i,
    });
    await expect(kpiFallos).toBeVisible();
    await kpiFallos.click();
    await expect(page).toHaveURL(/\/etl-monitor/);
  });

  test("muestra las 5 cards principales", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /estado general/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /alertas activas/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /tendencia etl/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /calidad — cuarentena/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /estado dwh/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /actividad reciente/i }),
    ).toBeVisible();
  });

  test("V3: click en card Tendencia ETL navega a /etl-monitor", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    const card = page.getByRole("link", {
      name: /abrir detalle: tendencia etl/i,
    });
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(/\/etl-monitor/);
  });
});
