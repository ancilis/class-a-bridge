import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type * as DocumentExports from "@class-a-bridge/documents";
import type { PreparationPackage, PreparationPackageOptions } from "@class-a-bridge/documents";
import {
  LocalStorageProjectStore,
  MemoryProjectStore,
  sha256Hex,
  type BridgeProject,
  type ProjectStore,
} from "@class-a-bridge/project";
import { ACME_METRICS_PROJECT } from "@class-a-bridge/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

type GeneratePreparationPackage = (
  project: BridgeProject,
  options?: PreparationPackageOptions,
) => Promise<PreparationPackage>;

const generatePreparationPackage = vi.hoisted(() => vi.fn<GeneratePreparationPackage>());
const PACKAGE_HASH = "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81";

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
      sha256: PACKAGE_HASH,
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
    await store.putAttachment("soc2-package-opt-in", sourceReportBytes, project.metadata.id);
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

  it("retains the exact generated package bytes and binds a final snapshot to them", async () => {
    const store = new MemoryProjectStore();
    const project = structuredClone(ACME_METRICS_PROJECT);
    project.metadata.id = "retained-package-project";
    await store.save(project);
    const user = userEvent.setup();
    render(<App storeFactory={() => Promise.resolve(store)} />);

    await user.click(
      await screen.findByRole("button", { name: /open saved project Acme Metrics/iu }),
    );
    await user.click(screen.getByRole("button", { name: "Package" }));
    await user.click(
      screen.getByRole("button", { name: /Create immutable final-review snapshot/iu }),
    );

    await waitFor(async () => {
      const saved = await store.load(project.metadata.id);
      expect(saved?.snapshots.at(-1)?.packageHash).toBe(PACKAGE_HASH);
      expect(saved?.generatedOutputs).toContainEqual(
        expect.objectContaining({
          kind: "preparation_package",
          format: "zip",
          sha256: PACKAGE_HASH,
        }),
      );
    });
    const saved = await store.load(project.metadata.id);
    const output = saved?.generatedOutputs.find((candidate) => candidate.sha256 === PACKAGE_HASH);
    expect(output).toBeDefined();
    expect(await store.getAttachment(output!.id)).toEqual(new Uint8Array([1, 2, 3]));
    expect(
      screen.getByRole("button", { name: /Download frozen package version 1\.0/iu }),
    ).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Project settings" }));
    expect(
      screen.getByRole("checkbox", {
        name: /Generated output — Preparation package version 1\.0/iu,
      }),
    ).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Export .classabridge" }));
    expect(
      await screen.findByText(/backup created with 3 selected generated output/iu),
    ).toBeInTheDocument();
  });

  it("discloses metadata-only retention in the browser storage fallback", async () => {
    const store: ProjectStore = new LocalStorageProjectStore(globalThis.localStorage);
    const project = structuredClone(ACME_METRICS_PROJECT);
    project.metadata.id = "fallback-final-snapshot";
    await store.save(project);
    const user = userEvent.setup();
    render(<App storeFactory={() => Promise.resolve(store)} />);

    await user.click(
      await screen.findByRole("button", { name: /open saved project Acme Metrics/iu }),
    );
    await user.click(screen.getByRole("button", { name: "Package" }));
    await user.click(
      screen.getByRole("button", { name: /Create immutable final-review snapshot/iu }),
    );

    expect(
      await screen.findByText(/storage fallback retained only snapshot metadata and hashes/iu),
    ).toBeInTheDocument();
    const saved = await store.load(project.metadata.id);
    const output = saved?.generatedOutputs.find((candidate) => candidate.sha256 === PACKAGE_HASH);
    expect(saved?.snapshots.at(-1)?.packageHash).toBe(PACKAGE_HASH);
    expect(output).toBeDefined();
    expect(await store.getAttachment(output!.id)).toBeUndefined();
  });
});
