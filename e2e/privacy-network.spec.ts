import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  PRIVATE_CANARY,
  fieldControl,
  navigateTo,
  observeProjectDataNetwork,
  openFirstRun,
  saveDownload,
  waitForLocalSave,
} from "./helpers/app";

test("production PDF, mapping, evidence, report, package, and export flow keeps project data local", async ({
  page,
}, testInfo) => {
  const network = await observeProjectDataNetwork(page);
  await openFirstRun(page);
  await page.getByRole("button", { name: /Start with my SOC 2 report/u }).click();
  await page
    .locator('input[type="file"][accept*="pdf"]')
    .setInputFiles(path.resolve("e2e/fixtures/fictional-soc2-privacy-canary.pdf"));

  await expect(
    page.getByRole("heading", { level: 1, name: /Review every suggested report value/u }),
  ).toBeVisible();
  const candidates = page.locator(".candidate");
  expect(await candidates.count()).toBeGreaterThan(0);
  await candidates.first().getByRole("button", { name: "Confirm" }).click();
  await page.getByRole("button", { name: "Continue to fit assessment" }).click();

  await navigateTo(page, "SOC 2 materials");
  const controlForm = page.getByRole("form", { name: "Add a SOC 2 control" });
  await controlForm.getByLabel("Control identifier").fill("E2E-CC8.1");
  await controlForm.getByLabel("Control title").fill(`${PRIVATE_CANARY} change logging`);
  await controlForm.getByLabel("Trust Services Criteria").fill("CC8.1");
  await controlForm.getByLabel("Report pages").fill("1");
  await controlForm.getByLabel("Auditor test").fill("Inspected fictional changes.");
  await controlForm.getByLabel("Auditor result").fill("No exceptions noted.");
  await controlForm.getByRole("button", { name: "Add SOC 2 control" }).click();

  await navigateTo(page, "SOC 2 reuse");
  const controlReview = page.getByRole("article", { name: "E2E-CC8.1 SOC 2 control review" });
  await controlReview.getByText("Edit and confirm this control").click();
  await fieldControl(controlReview, "Control reviewer").fill("Privacy Test Reviewer");
  await fieldControl(controlReview, "Control review date").fill("2026-07-18");
  await controlReview.getByRole("button", { name: "Confirm control record" }).click();
  await navigateTo(page, "SOC 2 materials");

  const mappingForm = page.getByRole("form", { name: "Add a SOC 2 mapping" });
  await mappingForm.getByLabel("SOC 2 control").selectOption("E2E-CC8.1");
  await mappingForm.getByLabel("Class A rule").selectOption("KSI-CMT-LMC");
  await mappingForm.getByRole("button", { name: "Add manual mapping" }).click();
  const mapping = page
    .locator(".mapping-list article")
    .filter({ hasText: "E2E-CC8.1 → KSI-CMT-LMC" });
  await fieldControl(mapping, "Mapping review outcome", "select").selectOption("partial_support");
  await fieldControl(mapping, "Reviewer").fill("Privacy Test Reviewer");
  await fieldControl(mapping, "Review date").fill("2026-07-18");
  await mapping.getByRole("checkbox", { name: /Mapping confirmed by a person/u }).check();

  await navigateTo(page, "Evidence");
  await fieldControl(page, "Title").fill(`${PRIVATE_CANARY} evidence`);
  await fieldControl(page, "Owner").fill("Local-only test owner");
  await fieldControl(page, "Local file (optional)").setInputFiles(
    path.resolve("e2e/fixtures/evidence-canary.csv"),
  );
  await page.getByRole("button", { name: "Add evidence candidate" }).click();
  await expect(page.getByText(`${PRIVATE_CANARY} evidence`, { exact: true })).toBeVisible();

  await navigateTo(page, "Reports");
  const reportCard = page.locator(".card").filter({ hasText: "SOC 2 Reuse and Gap Report" });
  const reportDownload = page.waitForEvent("download");
  await reportCard.getByRole("button", { name: "Download HTML" }).click();
  await saveDownload(await reportDownload, testInfo, "soc2-reuse.html");

  await navigateTo(page, "Package");
  const packageDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Generate package ZIP" }).click();
  await saveDownload(await packageDownload, testInfo, "preparation-package.zip");

  await navigateTo(page, "Project settings");
  await waitForLocalSave(page);
  const projectDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export .classabridge" }).click();
  await saveDownload(await projectDownload, testInfo, "privacy-test.classabridge");

  network.assertClean();
});
