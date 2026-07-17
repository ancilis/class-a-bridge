import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as DocumentExports from "@class-a-bridge/documents";
import type { PreparationPackage, PreparationPackageOptions } from "@class-a-bridge/documents";
import { MemoryProjectStore, sha256Hex, type BridgeProject } from "@class-a-bridge/project";
import { ACME_METRICS_PROJECT } from "@class-a-bridge/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

type GeneratePreparationPackage = (
  project: BridgeProject,
  options?: PreparationPackageOptions,
) => Promise<PreparationPackage>;

const generatePreparationPackage = vi.hoisted(() => vi.fn<GeneratePreparationPackage>());

vi.mock("@class-a-bridge/documents", async (importOriginal) => {
  const actual = await importOriginal<typeof DocumentExports>();
  return { ...actual, generatePreparationPackage };
});

import { App } from "../src/App";

describe("final-review package freshness", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    generatePreparationPackage.mockReset().mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      fileName: "package.zip",
      mimeType: "application/zip",
      sha256: "a".repeat(64),
      validation: { valid: true, documents: [] },
    } as unknown as PreparationPackage);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:test"),
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  it("regenerates from the current project before creating an immutable snapshot", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /explore a fictional sample/iu }));
    await user.click(screen.getByRole("button", { name: "Package" }));
    await user.click(screen.getByRole("button", { name: /Generate package ZIP/iu }));
    await waitFor(() => expect(generatePreparationPackage).toHaveBeenCalledTimes(1));

    await user.clear(screen.getByLabelText("Offering website"));
    await user.type(screen.getByLabelText("Offering website"), "https://updated.example");
    expect(screen.getByRole("status", { name: /package result freshness/iu })).toHaveTextContent(
      /Project changed since this validation ran.*regenerate/iu,
    );
    await user.click(
      screen.getByRole("button", { name: /Create immutable final-review snapshot/iu }),
    );

    await waitFor(() => expect(generatePreparationPackage).toHaveBeenCalledTimes(2));
    expect(
      generatePreparationPackage.mock.calls[1]?.[0].packageInputs.certificationPackageOverview
        .website,
    ).toBe("https://updated.example");
    await waitFor(() =>
      expect(
        screen.queryByRole("status", { name: /package result freshness/iu }),
      ).not.toBeInTheDocument(),
    );
  });

  it("includes package attachments only after the user explicitly selects them", async () => {
    const store = new MemoryProjectStore();
    const project = structuredClone(ACME_METRICS_PROJECT);
    const sourceReportBytes = new Uint8Array([7, 8, 9]);
    project.soc2.sourceReport = {
      fileName: "acme-confidential-soc2.pdf",
      attachmentId: "soc2-package-opt-in",
      sha256: await sha256Hex(sourceReportBytes),
    };
    await store.save(project);
    await store.putAttachment(
      "soc2-package-opt-in",
      sourceReportBytes,
      project.metadata.id,
    );
    const user = userEvent.setup();
    render(<App storeFactory={() => Promise.resolve(store)} />);
    await user.click(
      await screen.findByRole("button", { name: /open saved project Acme Metrics/iu }),
    );
    await user.click(screen.getByRole("button", { name: "Package" }));

    const attachment = screen.getByRole("checkbox", {
      name: /Original SOC 2 report.*acme-confidential-soc2\.pdf/iu,
    });
    expect(attachment).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: /Generate package ZIP/iu }));
    await waitFor(() => expect(generatePreparationPackage).toHaveBeenCalledTimes(1));
    expect(generatePreparationPackage.mock.calls[0]?.[1]?.selectedAttachments).toEqual([]);
    expect(
      generatePreparationPackage.mock.calls[0]?.[1]?.officialDocuments?.certificationPackageOverview
        ?.logoUrl,
    ).toBe("https://example.com/acme-metrics/fictional-logo.svg");

    await user.click(attachment);
    await user.click(screen.getByRole("button", { name: /Generate package ZIP/iu }));
    await waitFor(() => expect(generatePreparationPackage).toHaveBeenCalledTimes(2));
    expect(generatePreparationPackage.mock.calls[1]?.[1]?.selectedAttachments).toEqual([
      expect.objectContaining({
        attachmentId: "soc2-package-opt-in",
        userApproved: true,
        bytes: new Uint8Array([7, 8, 9]),
      }),
    ]);
  });
});
