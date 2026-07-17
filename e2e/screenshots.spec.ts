import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { navigateTo, openFirstRun, openSample } from "./helpers/app";

const screenshotPath = (fileName: string) => path.resolve("docs/screenshots", fileName);

const prepareCapture = async (page: Page) => {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);
};

test("capture release screenshots from the working browser application", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await openFirstRun(page);
  await prepareCapture(page);
  await page.screenshot({ path: screenshotPath("bridge-first-run.png"), fullPage: true });

  await openSample(page);
  await prepareCapture(page);
  await page.screenshot({ path: screenshotPath("bridge-sample-overview.png"), fullPage: true });

  await navigateTo(page, "Eligibility");
  await expect(page.getByRole("heading", { level: 1, name: "Needs expert review" })).toBeVisible();
  await prepareCapture(page);
  await page.screenshot({ path: screenshotPath("bridge-eligibility-result.png"), fullPage: true });

  await navigateTo(page, "Class A requirements");
  await page.locator(".rule-list__item").filter({ hasText: "KSI-CMT-LMC" }).click();
  await prepareCapture(page);
  await page.screenshot({ path: screenshotPath("bridge-ksi-workflow.png"), fullPage: true });

  await navigateTo(page, "Package");
  await prepareCapture(page);
  await page.screenshot({ path: screenshotPath("bridge-package-workspace.png"), fullPage: true });
});
