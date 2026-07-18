import { expect, type Download, type Locator, type Page, type TestInfo } from "@playwright/test";

export const PRIVATE_CANARY = "CLASS_A_BRIDGE_E2E_PRIVATE_CANARY_9f77c248";

export const STRONG_ANSWERS = ["Yes", "Yes", "Yes", "No", "No", "No", "Yes", "Yes"] as const;

export const ELIGIBILITY_QUESTIONS = [
  "Is the current report a SOC 2 Type II report?",
  "Was that assessment completed within the applicable 12-month period?",
  "Does the report cover the product you are considering for Class A?",
  "Will the federal offering differ materially from the audited commercial product?",
  "Were important infrastructure or service providers carved out of the report?",
  "Does the report contain exceptions that could affect this offering?",
  "Is the product operated for customers as a cloud service?",
  "Do you have a defined federal use case for the offering?",
] as const;

export async function openFirstRun(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Turn your SOC 2 Type II into a clear Class A plan.",
    }),
  ).toBeVisible();
}

export async function openSample(page: Page) {
  await openFirstRun(page);
  await page.getByRole("button", { name: /Explore a fictional sample workspace/u }).click();
  await expect(
    page.getByText("Fictional demonstration — not an actual certification package."),
  ).toBeVisible();
  await expect(page.getByText("Acme Metrics", { exact: true }).first()).toBeVisible();
}

export async function startManualAssessment(
  page: Page,
  answers: readonly ("Yes" | "No" | "Not sure")[] = STRONG_ANSWERS,
) {
  if (answers.length !== ELIGIBILITY_QUESTIONS.length)
    throw new Error("The preliminary assessment must receive exactly eight answers.");
  await openFirstRun(page);
  await page.getByRole("button", { name: /Start without uploading a report/u }).click();
  for (const [index, question] of ELIGIBILITY_QUESTIONS.entries()) {
    await expect(page.getByRole("heading", { level: 2, name: question })).toBeVisible();
    const answer = answers[index];
    if (!answer) throw new Error(`Missing answer for question ${index + 1}.`);
    await page.getByRole("button", { name: answer, exact: true }).click();
  }
  await expect(page.getByText("Deterministic from 8 confirmed answers")).toBeVisible();
}

export async function navigateTo(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Project navigation" })
    .getByRole("button", { name })
    .click();
}

/**
 * Field currently wraps controls in a visual `.field` container. Keeping this
 * selector local makes the interaction tests readable while the accessibility
 * test independently enforces real label associations.
 */
export function fieldControl(
  page: Page | Locator,
  label: string,
  control: "input" | "select" | "textarea" = "input",
): Locator {
  return page.locator(".field").filter({ hasText: label }).locator(control).first();
}

export async function saveDownload(download: Download, testInfo: TestInfo, fileName: string) {
  const path = testInfo.outputPath(fileName);
  await download.saveAs(path);
  expect(await download.failure()).toBeNull();
  return path;
}

export async function observeProjectDataNetwork(page: Page, canary = PRIVATE_CANARY) {
  const unexpected: string[] = [];
  const leaked: string[] = [];
  const expectedOrigin = new URL(process.env["PLAYWRIGHT_BASE_URL"] ?? "http://127.0.0.1:4173")
    .origin;
  page.on("websocket", (socket) => {
    unexpected.push(`WEBSOCKET ${socket.url()}`);
    if (socket.url().includes(canary)) leaked.push(`WEBSOCKET ${socket.url()}`);
    socket.on("framesent", ({ payload }) => {
      const body = typeof payload === "string" ? payload : payload.toString("utf8");
      if (body.includes(canary)) leaked.push(`WEBSOCKET FRAME ${socket.url()}`);
    });
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const requestText = [
      request.url(),
      request.method(),
      request.postData() ?? "",
      JSON.stringify(request.headers()),
    ].join("\n");
    if (requestText.includes(canary)) leaked.push(`${request.method()} ${request.url()}`);
    const url = new URL(request.url());
    const isStaticPath =
      ["/", "/index.html", "/sw.js", "/manifest.webmanifest"].includes(url.pathname) ||
      url.pathname.startsWith("/assets/") ||
      /^\/(?:icon|favicon|apple-touch-icon)/u.test(url.pathname);
    const isStaticGet = url.origin === expectedOrigin && request.method() === "GET" && isStaticPath;
    if (!isStaticGet)
      unexpected.push(`${request.method()} ${request.resourceType()} ${request.url()}`);
    if (requestText.includes(canary) || !isStaticGet) await route.abort("blockedbyclient");
    else await route.continue();
  });
  return {
    assertClean() {
      expect(leaked, "document or project canary must never enter a request").toEqual([]);
      expect(unexpected, "normal assessment flow must make only same-origin static GETs").toEqual(
        [],
      );
    },
  };
}

export async function waitForLocalSave(page: Page) {
  await expect(page.getByRole("status", { name: "Local save status" })).toContainText(
    "Saved locally",
    { timeout: 5_000 },
  );
}
