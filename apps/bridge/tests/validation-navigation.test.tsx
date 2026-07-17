import { MemoryProjectStore } from "@class-a-bridge/project";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as DocumentExports from "@class-a-bridge/documents";
import { beforeEach, describe, expect, it, vi } from "vitest";

const generatePreparationPackage = vi.hoisted(() => vi.fn());
const PACKAGE_HASH = "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81";

vi.mock("@class-a-bridge/documents", async (importOriginal) => {
  const actual = await importOriginal<typeof DocumentExports>();
  return { ...actual, generatePreparationPackage };
});

import { App, validationEditTarget } from "../src/App";

describe("package validation navigation", () => {
  it("maps parent and ambiguous schema issues to fields that can resolve them", () => {
    expect(validationEditTarget("ongoing-certification-report", "/reportPeriod")).toMatchObject({
      id: "package-ocr-report-from",
      label: "Edit report period",
    });
    expect(
      validationEditTarget("ongoing-certification-report", "/plannedCertificationDataChanges"),
    ).toMatchObject({
      id: "package-ocr-planned-changes",
      label: "Edit planned certification changes",
    });
    expect(
      validationEditTarget("certification-package-overview", "/contactInformation"),
    ).toMatchObject({
      id: "package-cpo-contacts",
      label: "Edit provider contacts",
    });
  });

  beforeEach(() => {
    generatePreparationPackage.mockReset().mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      fileName: "package.zip",
      mimeType: "application/zip",
      sha256: PACKAGE_HASH,
      validation: {
        valid: false,
        documents: [
          {
            name: "certification-package-overview",
            valid: false,
            issues: [
              {
                pointer: "/serviceProperties/serviceType",
                route: "#/package/certification-package-overview/serviceProperties/serviceType",
                keyword: "minItems",
                expected: "At least one service model.",
                current: [],
                resolution: "Select the service model for this offering.",
              },
            ],
          },
        ],
      },
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:test"),
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  it("opens and focuses the field that can resolve a schema issue", async () => {
    const user = userEvent.setup();
    render(<App storeFactory={() => Promise.resolve(new MemoryProjectStore())} />);

    await user.click(screen.getByRole("button", { name: /start without uploading/iu }));
    await user.click(screen.getByRole("button", { name: "Package" }));
    await user.click(screen.getByRole("button", { name: "Generate package ZIP" }));

    const edit = await screen.findByRole("button", { name: "Edit service models" });
    await user.click(edit);

    expect(
      screen.getByRole("heading", { name: "Project settings and data management" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector("#settings-service-models")).toHaveFocus());
  }, 20_000);
});
