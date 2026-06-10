import { test, expect, type Page } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const EMPTY_VIEWS: Array<{
  nombre: string;
  label: string;
  descripcion: string;
  columnas: string[];
  tipos: Record<string, string>;
}> = [
  {
    nombre: "vw_cosecha_mensual",
    label: "Cosecha mensual",
    descripcion: "Producción mensual",
    columnas: ["fecha", "variedad", "toneladas"],
    tipos: { fecha: "fecha", variedad: "texto", toneladas: "numero" },
  },
];

const EMPTY_HOME = { widgets: [], savedAt: null };
const EMPTY_NOTIFICATIONS = { items: [], total: 0, no_leidas: 0 };

async function stubAnalystRoutes(page: Page) {
  await page.route("**/api/analyst/home", (route) => {
    if (route.request().method() === "GET") {
      route.fulfill({ json: EMPTY_HOME });
    } else {
      route.fulfill({ json: { ok: true } });
    }
  });
  await page.route("**/api/analyst/views", (route) =>
    route.fulfill({ json: EMPTY_VIEWS }),
  );
  await page.route("**/api/analyst/notifications**", (route) =>
    route.fulfill({ json: EMPTY_NOTIFICATIONS }),
  );
  await page.route("**/api/analyst/widget", (route) =>
    route.fulfill({
      json: {
        data: [{ type: "bar", x: ["A", "B"], y: [10, 20] }],
        layout: {},
        meta: { filas: 2 },
      },
    }),
  );
  // Suprimir rutas del control-center que podrían cargar en el shell
  await page.route("**/api/cc/**", (route) =>
    route.fulfill({ status: 200, json: {} }),
  );
}

test.describe("Portal Analista — smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "analyst", "Analista Test");
    await stubAnalystRoutes(page);
  });

  test("analyst accede a /home y ve el workspace", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL("/home");
    await expect(page.getByText("Mi Workspace")).toBeVisible();
    // Workspace vacío — ver empty state o toolbar
    await expect(page.getByRole("button", { name: /editar layout/i })).toBeVisible();
  });

  test("sidebar del analista muestra rutas correctas", async ({ page }) => {
    await page.goto("/home");
    // Debe tener enlace al workspace
    await expect(page.getByRole("link", { name: /workspace/i })).toBeVisible();
    // NO debe mostrar rutas exclusivas del admin
    await expect(page.getByRole("link", { name: /^dashboard$/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /etl.monitor/i })).not.toBeVisible();
  });

  test("analista puede abrir el modal de nuevo widget", async ({ page }) => {
    await page.goto("/home");
    await page.getByRole("button", { name: /editar layout/i }).click();
    await page.getByRole("button", { name: /widget/i }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("Nuevo widget")).toBeVisible();
  });

  test("analista NO puede acceder a /dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    // Debe redirigir a /home (rol analyst, ROLE_HOME = /home)
    await expect(page).not.toHaveURL("/dashboard");
    // Debe terminar en /home o /login
    const url = page.url();
    expect(url.includes("/home") || url.includes("/login")).toBeTruthy();
  });

  test("página de notificaciones carga sin errores", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page).toHaveURL("/notifications");
    await expect(page.getByText("Notificaciones")).toBeVisible();
    // Verificar que no hay error 403 ni 500
    await expect(page.getByText(/no autorizado/i)).not.toBeVisible();
    await expect(page.getByText(/error interno/i)).not.toBeVisible();
    // Estado vacío — sin notificaciones
    await expect(page.getByText("Sin notificaciones")).toBeVisible();
  });

  test("analista con JWT admin no puede pasar como analyst", async ({ page }) => {
    // Sobreescribir cookie con rol admin — NO debe acceder a /home sin redirección
    // (este test verifica que el RBAC en el layout sí aplica)
    await loginAs(page, "admin", "Admin Test");
    await page.goto("/home");
    // El admin debería ser redirigido a /dashboard (su ROLE_HOME)
    await expect(page).not.toHaveURL("/home");
  });
});
