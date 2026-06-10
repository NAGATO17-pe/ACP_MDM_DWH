import { defineConfig, devices } from "@playwright/test";

/**
 * Configuración mínima para ejecutar smoke tests cuando ya hay un
 * servidor de desarrollo corriendo en puerto 3000.
 * Uso: npx playwright test --config=playwright.smoke.config.ts
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: false,
  retries: 0,
  workers: undefined,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // Sin bloque webServer — reutiliza el servidor ya activo en :3000
});
