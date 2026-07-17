import path from "node:path";

import { expect, test } from "@playwright/test";

import { fieldControl, navigateTo, openSample, saveDownload } from "./helpers/app";

test("a user maps a SOC 2 control to a Class A requirement", async ({ page }) => {
  await openSample(page);
  await navigateTo(page, "SOC 2 materials");

  const mappingForm = page.locator(".mapping-form");
  await mappingForm.locator("select").nth(0).selectOption("ACME-CC8.1");
  await mappingForm.locator('input[type="number"]').fill("71");
  await mappingForm.locator("select").nth(1).selectOption("FRC-CSO-JSN");
  await mappingForm.getByRole("button", { name: "Add manual mapping" }).click();

  const mapping = page
    .locator(".mapping-list article")
    .filter({ hasText: "ACME-CC8.1 → FRC-CSO-JSN" });
  await expect(mapping).toContainText("Page 71");
  await expect(
    mapping.getByRole("checkbox", { name: /Mapping confirmed by a person/u }),
  ).toBeChecked();
  await mapping.getByRole("combobox").selectOption("partially_covered");
});

test("a user adds local evidence metadata and a file without an upload", async ({ page }) => {
  await openSample(page);
  await navigateTo(page, "Evidence");

  await fieldControl(page, "Title").fill("E2E production log sample");
  await fieldControl(page, "Owner").fill("Platform Security");
  await fieldControl(page, "Local file (optional)").setInputFiles(
    path.resolve("e2e/fixtures/evidence-canary.csv"),
  );
  await page.getByRole("button", { name: "Add evidence candidate" }).click();

  const evidence = page
    .locator(".evidence-list article")
    .filter({ hasText: "E2E production log sample" });
  await expect(evidence).toContainText("Platform Security");
  await expect(evidence).toContainText("Local file: evidence-canary.csv");
  await expect(evidence).toContainText("Evidence candidate");
  await evidence.getByRole("combobox", { name: /Review status/u }).selectOption("reviewed");
  await expect(evidence).toContainText("Reviewed");
});

test("a user completes a KSI requirement narrative and controls its status", async ({ page }) => {
  await openSample(page);
  await navigateTo(page, "Class A requirements");
  await page.locator(".rule-list__item").filter({ hasText: "KSI-CMT-LMC" }).click();

  await fieldControl(page, "Implementation explanation", "textarea").fill(
    "Production changes produce immutable audit events reviewed by the platform owner each business day.",
  );
  await fieldControl(page, "Verification explanation", "textarea").fill(
    "The reviewer samples an approved change and reconciles the ticket to the resulting log event.",
  );
  await fieldControl(page, "Completion status", "select").selectOption(
    "complete_for_internal_review",
  );
  await expect(page.locator(".requirement-detail")).toContainText("Complete for internal review");

  await navigateTo(page, "Overview");
  await navigateTo(page, "Class A requirements");
  await page.locator(".rule-list__item").filter({ hasText: "KSI-CMT-LMC" }).click();
  await expect(fieldControl(page, "Implementation explanation", "textarea")).toHaveValue(
    /immutable audit events/u,
  );
});

test("a user generates a package and sees understandable JSON validation", async ({
  page,
}, testInfo) => {
  await openSample(page);
  await navigateTo(page, "Package");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Generate package ZIP" }).click();
  const download = await downloadPromise;
  const saved = await saveDownload(download, testInfo, "acme-preparation-package.zip");
  expect(path.basename(saved)).toBe("acme-preparation-package.zip");

  await expect(
    page.getByRole("heading", { level: 2, name: "JSON validation results" }),
  ).toBeVisible();
  await expect(page.getByText("Structurally valid", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText(/does not establish accuracy, completeness, approval/u),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /official browser validator/u })).toHaveAttribute(
    "href",
    "https://www.fedramp.gov/schemas/",
  );
});
