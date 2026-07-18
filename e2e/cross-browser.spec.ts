import { expect, test } from "@playwright/test";

import { navigateTo, openSample } from "./helpers/app";

test("sample and core workspace navigation smoke across major browser engines", async ({
  page,
}) => {
  await openSample(page);
  await navigateTo(page, "Class A requirements");
  await expect(page.getByRole("heading", { level: 1, name: "Class A requirements" })).toBeVisible();
  await page.locator(".rule-list__item").filter({ hasText: "KSI-CMT-LMC" }).click();
  await expect(page.getByText(/Guided task 1 of 9/iu)).toBeVisible();
  await page.getByRole("button", { name: "Record mode" }).click();
  await expect(
    page.getByText("Dedicated Key Security Indicator workflow", { exact: true }),
  ).toBeVisible();
  await navigateTo(page, "Package");
  await expect(page.getByRole("button", { name: "Generate package ZIP" })).toBeEnabled();
});
