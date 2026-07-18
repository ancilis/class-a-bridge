import { expect, test } from "@playwright/test";

import { navigateTo, openSample } from "./helpers/app";

test("the complete fictional workspace is clearly marked and navigable", async ({ page }) => {
  await openSample(page);
  await expect(page.getByRole("heading", { level: 1, name: "Acme Metrics Cloud" })).toBeVisible();
  await expect(page.getByText("Needs expert review", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/mandatory requirement records/iu)).toBeVisible();

  const navigation = page.getByRole("navigation", { name: "Project navigation" });
  await expect(navigation.getByRole("button")).toHaveCount(11);
  for (const destination of [
    "Scope",
    "SOC 2 materials",
    "SOC 2 reuse",
    "Class A requirements",
    "Evidence",
    "Action plan",
    "Package",
    "Reports",
    "Project settings",
  ]) {
    await navigateTo(page, destination);
    await expect(page.locator("#main-content h1")).toBeVisible();
  }
});
