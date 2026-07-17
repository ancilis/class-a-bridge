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
  const installed = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const cacheNames = await caches.keys();
    const cachedUrls = (
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith("class-a-bridge-"))
          .map(async (name) => (await caches.open(name)).keys()),
      )
    )
      .flat()
      .map((request) => request.url);
    return {
      active: registration.active?.state,
      cacheNames,
      cachedUrls,
    };
  });
  expect(installed.active).toBe("activated");
  expect(installed.cachedUrls).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/\/assets\/index-[^/]+\.js$/u),
      expect.stringMatching(/\/assets\/index-[^/]+\.css$/u),
    ]),
  );

  // A first install must cache every generated dependency before the network disappears.
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { level: 1, name: /Turn your SOC 2 Type II/u }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Start without uploading a report/u }).click();
  await expect(page.getByText("Question 1 of 8", { exact: true })).toBeVisible();
});
