import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  PRIVATE_CANARY,
  fieldControl,
  navigateTo,
  observeProjectDataNetwork,
  openSample,
  saveDownload,
  waitForLocalSave,
} from "./helpers/app";

test("a project exports, deletes, imports, and restores the original record", async ({
  page,
}, testInfo) => {
  await openSample(page);
  await navigateTo(page, "Project settings");
  await fieldControl(page, "Organization").fill("Acme Metrics restoration canary");
  await fieldControl(page, "Cloud service offering").fill("Acme Metrics Restored Cloud");
  await waitForLocalSave(page);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export .classabridge" }).click();
  const backupPath = await saveDownload(await downloadPromise, testInfo, "acme.classabridge");

  await page.getByRole("button", { name: "Review deletion options" }).click();
  await page.getByRole("button", { name: "Delete this project now" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: /Turn your SOC 2 Type II/u }),
  ).toBeVisible();

  // Import is currently reachable only after creating a temporary project.
  await page.getByRole("button", { name: /Start without uploading a report/u }).click();
  await navigateTo(page, "Project settings");
  await fieldControl(page, "Choose backup").setInputFiles(backupPath);

  await expect(page.getByRole("status")).toContainText(
    "Restored “Acme Metrics Class A preparation”",
  );
  await expect(fieldControl(page, "Organization")).toHaveValue("Acme Metrics restoration canary");
  await expect(fieldControl(page, "Cloud service offering")).toHaveValue(
    "Acme Metrics Restored Cloud",
  );
  await navigateTo(page, "Overview");
  await expect(
    page.getByRole("heading", { level: 1, name: "Acme Metrics Restored Cloud" }),
  ).toBeVisible();
  expect(path.extname(backupPath)).toBe(".classabridge");
});

test("normal assessment and local evidence flow transmit no project data", async ({ page }) => {
  const network = await observeProjectDataNetwork(page);
  await openSample(page);
  await navigateTo(page, "Evidence");
  await fieldControl(page, "Title").fill(PRIVATE_CANARY);
  await fieldControl(page, "Owner").fill("Local-only owner");
  await fieldControl(page, "Local file (optional)").setInputFiles(
    path.resolve("e2e/fixtures/evidence-canary.csv"),
  );
  await page.getByRole("button", { name: "Add evidence candidate" }).click();
  await expect(page.getByText(PRIVATE_CANARY, { exact: true })).toBeVisible();
  await navigateTo(page, "Class A requirements");
  await page.locator(".rule-list__item").filter({ hasText: "KSI-CMT-LMC" }).click();
  await fieldControl(page, "Provider response", "textarea").fill(`${PRIVATE_CANARY} stays local.`);
  await waitForLocalSave(page);
  network.assertClean();
});
