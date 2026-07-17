import { expect, test } from "@playwright/test";

import { openFirstRun } from "./helpers/app";

test("the production PWA shell remains usable after the network is removed", async ({
  context,
  page,
}) => {
  await openFirstRun(page);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "./manifest.webmanifest",
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  // One controlled online reload lets the active worker cache fingerprinted assets.
  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: /Turn your SOC 2 Type II/u }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: /Turn your SOC 2 Type II/u }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Start without uploading a report/u }).click();
  await expect(page.getByText("Question 1 of 8", { exact: true })).toBeVisible();
});
