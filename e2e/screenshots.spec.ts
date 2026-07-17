import path from "node:path";

import { expect, test } from "@playwright/test";

import { navigateTo, openFirstRun, openSample } from "./helpers/app";

const screenshotPath = (fileName: string) => path.resolve("docs/screenshots", fileName);

test("capture release screenshots from the working browser application", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await openFirstRun(page);
  await page.screenshot({ path: screenshotPath("bridge-first-run.png"), fullPage: true });

  await openSample(page);
  await page.screenshot({ path: screenshotPath("bridge-sample-overview.png"), fullPage: true });

  await navigateTo(page, "Eligibility");
  await expect(page.getByRole("heading", { level: 1, name: "Needs expert review" })).toBeVisible();
  await page.screenshot({ path: screenshotPath("bridge-eligibility-result.png"), fullPage: true });

  await navigateTo(page, "Class A requirements");
  await page.locator(".rule-list__item").filter({ hasText: "KSI-CMT-LMC" }).click();
  await page.screenshot({ path: screenshotPath("bridge-ksi-workflow.png"), fullPage: true });

  await navigateTo(page, "Package");
  await page.screenshot({ path: screenshotPath("bridge-package-workspace.png"), fullPage: true });
});
