import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results/playwright",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 2 : 0,
  ...(process.env["CI"] ? { workers: 2 } : {}),
  reporter: process.env["CI"]
    ? [["line"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    acceptDownloads: true,
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  ...(process.env["PLAYWRIGHT_BASE_URL"]
    ? {}
    : {
        webServer: {
          command:
            "pnpm --filter @class-a-bridge/bridge build && pnpm --filter @class-a-bridge/bridge preview --host 127.0.0.1 --port 4173",
          url: baseURL,
          reuseExistingServer: !process.env["CI"],
          timeout: 120_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testMatch: /cross-browser\.spec\.ts/u,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testMatch: /cross-browser\.spec\.ts/u,
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
