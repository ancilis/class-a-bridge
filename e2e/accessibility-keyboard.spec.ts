import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { navigateTo, openFirstRun, openSample } from "./helpers/app";

test("the first-run path is operable by keyboard with a visible focus indicator", async ({
  page,
}) => {
  await openFirstRun(page);
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await expect(skipLink).toBeFocused();
  const focusStyle = await page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) return { style: "none", width: "0px" };
    const style = getComputedStyle(element);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(focusStyle.style).not.toBe("none");
  expect(Number.parseFloat(focusStyle.width)).toBeGreaterThanOrEqual(2);

  await page.keyboard.press("Enter");
  await expect(page.locator("main#main-content")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /Start with my SOC 2 report/u })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: /Start without uploading a report/u }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Question 1 of 8", { exact: true })).toBeVisible();
});

test("the workspace has one main landmark and every editable control has an accessible name", async ({
  page,
}) => {
  await openSample(page);
  for (const destination of [
    "Eligibility",
    "Scope",
    "SOC 2 materials",
    "Class A requirements",
    "Evidence",
    "Action plan",
    "Package",
    "Project settings",
  ]) {
    await navigateTo(page, destination);
    await expect(page.locator("main#main-content")).toHaveCount(1);
    await expect(page.locator("main#main-content h1")).toHaveCount(1);
    const unnamed = await page
      .locator("main#main-content input, main#main-content select, main#main-content textarea")
      .evaluateAll((controls) =>
        controls
          .filter((control) => {
            const element = control as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
            if (element.type === "hidden") return false;
            const labelledBy = element.getAttribute("aria-labelledby");
            const ariaLabel = element.getAttribute("aria-label");
            const labels = "labels" in element ? (element.labels?.length ?? 0) : 0;
            return !ariaLabel?.trim() && !labelledBy?.trim() && labels === 0;
          })
          .map((control) => ({
            tag: control.tagName.toLowerCase(),
            type: control.getAttribute("type"),
            name: control.getAttribute("name"),
            placeholder: control.getAttribute("placeholder"),
          })),
      );
    expect(unnamed, `${destination} contains controls without programmatic labels`).toEqual([]);
  }
});

test("first run and the sample overview have no automatically detectable WCAG A or AA violations", async ({
  page,
}) => {
  await openFirstRun(page);
  const firstRun = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(firstRun.violations).toEqual([]);

  await openSample(page);
  const overview = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(overview.violations).toEqual([]);
});
