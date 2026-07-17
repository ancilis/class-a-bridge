import { expect, test } from "@playwright/test";

import {
  ELIGIBILITY_QUESTIONS,
  fieldControl,
  navigateTo,
  openFirstRun,
  openSample,
  startManualAssessment,
} from "./helpers/app";

test("a new user starts without an account and receives a reasoned result after eight questions", async ({
  page,
}) => {
  await openFirstRun(page);
  await expect(page.getByRole("region", { name: "Choose how to begin" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Start with my SOC 2 report/u })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Start without uploading a report/u }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Explore a fictional sample workspace/u }),
  ).toBeVisible();
  await expect(page.locator('input[type="email"], input[name*="account" i]')).toHaveCount(0);

  await startManualAssessment(page);

  await expect(page.getByRole("heading", { level: 1, name: "Likely fit" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Next three actions" })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 3, name: "Missing external assessment materials" }),
  ).toBeVisible();
  await expect(page.getByText("Complete SOC 2 Type II report", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Verified audit-engagement documentation", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/not a FedRAMP determination, certification, approval/u),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Answers and rationale" }),
  ).toBeVisible();
});

test("editing an eligibility answer changes the result and exposes provenance", async ({
  page,
}) => {
  await openSample(page);
  await navigateTo(page, "Eligibility");
  await expect(page.getByRole("heading", { level: 1, name: "Needs expert review" })).toBeVisible();

  const carveOutRow = page
    .locator(".answer-review__row")
    .filter({ hasText: ELIGIBILITY_QUESTIONS[4] });
  const exceptionRow = page
    .locator(".answer-review__row")
    .filter({ hasText: ELIGIBILITY_QUESTIONS[5] });
  await carveOutRow.locator("select").selectOption("no");
  await exceptionRow.locator("select").selectOption("no");

  await expect(page.getByRole("heading", { level: 1, name: "Likely fit" })).toBeVisible();
  await expect(
    page.getByText(/do not identify an immediate eligibility or scope blocker/u),
  ).toBeVisible();
  await page
    .locator("details.finding")
    .filter({ hasText: "Preliminary alignment" })
    .locator("summary")
    .click();
  await expect(page.getByText("deterministic", { exact: true })).toBeVisible();
  await expect(page.getByText(/Confirmed report dates, system scope/u)).toBeVisible();

  // The field helper is exercised here so selector drift is caught centrally.
  await navigateTo(page, "Project settings");
  await expect(fieldControl(page, "Organization")).toHaveValue("Acme Metrics");
});
