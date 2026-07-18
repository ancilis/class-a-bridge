import { MemoryProjectStore, sha256Hex, type BridgeProject } from "@class-a-bridge/project";
import { ACME_METRICS_PROJECT } from "@class-a-bridge/testing";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { describe, expect, it } from "vitest";

import { Evidence } from "../src/App";
import { persistProjectWithAttachmentAtomically } from "../src/lib/backup";
import { deriveActions, initializeProject } from "../src/lib/workspace";

function EvidenceHarness({
  initialProject,
  store,
}: {
  readonly initialProject: BridgeProject;
  readonly store: MemoryProjectStore;
}) {
  const [project, setProject] = useState(() => structuredClone(initialProject));

  useEffect(() => {
    void store.save(project);
  }, [project, store]);

  const update = (recipe: (draft: BridgeProject) => void) => {
    setProject((current) => {
      const next = structuredClone(current);
      recipe(next);
      next.metadata.updatedAt = new Date().toISOString();
      next.actions = deriveActions(next);
      return next;
    });
  };

  return (
    <Evidence
      project={project}
      update={update}
      store={store}
      persistAttachmentProject={async (next, attachment) => {
        await persistProjectWithAttachmentAtomically(store, next, attachment);
        setProject(structuredClone(next));
      }}
    />
  );
}

describe("evidence metadata", () => {
  it("creates and edits a fully described evidence candidate", async () => {
    const user = userEvent.setup();
    render(
      <EvidenceHarness initialProject={ACME_METRICS_PROJECT} store={new MemoryProjectStore()} />,
    );

    const form = screen.getByRole("form", { name: "Add an evidence candidate" });
    fireEvent.change(within(form).getByLabelText("Title"), {
      target: { value: "Quarterly access review record" },
    });
    fireEvent.change(within(form).getByLabelText("Description"), {
      target: { value: "Approved user-access review for the production offering." },
    });
    await user.selectOptions(within(form).getByLabelText("Evidence type"), "policy");
    fireEvent.change(within(form).getByLabelText("Source system"), {
      target: { value: "Governance repository" },
    });
    fireEvent.change(within(form).getByLabelText("Owner"), {
      target: { value: "Identity team" },
    });
    fireEvent.change(within(form).getByLabelText("Collection date"), {
      target: { value: "2026-07-17" },
    });
    fireEvent.change(within(form).getByLabelText("Relevant period"), {
      target: { value: "2026 Q2" },
    });
    fireEvent.change(within(form).getByLabelText("Review or expiration date"), {
      target: { value: "2026-10-17" },
    });
    await user.selectOptions(within(form).getByLabelText("Sensitivity"), "restricted");
    fireEvent.change(within(form).getByLabelText("Notes"), {
      target: { value: "Evidence candidate pending reviewer confirmation." },
    });
    await user.click(within(form).getByText("Relate to Class A requirements"));
    await user.click(within(form).getByLabelText("Relate to KSI-IAM-AAM"));
    await user.click(within(form).getByText("Relate to SOC 2 controls"));
    await user.click(within(form).getByLabelText("Relate to ACME-CC6.1"));
    await user.click(within(form).getByRole("button", { name: "Add evidence candidate" }));

    const item = await screen.findByRole("article", {
      name: "Evidence candidate Quarterly access review record",
    });
    expect(item).toHaveTextContent("Governance repository");
    expect(item).toHaveTextContent("2026 Q2");
    expect(item).toHaveTextContent("Restricted");

    await user.click(
      within(item).getByLabelText("Edit evidence metadata for Quarterly access review record"),
    );
    const description = within(item).getByLabelText("Description");
    fireEvent.change(description, { target: { value: "Updated reviewer-approved description." } });
    expect(description).toHaveValue("Updated reviewer-approved description.");
  });

  it("hashes a normalized external reference and locks its hash identity", async () => {
    const store = new MemoryProjectStore();
    const user = userEvent.setup();
    render(<EvidenceHarness initialProject={initializeProject()} store={store} />);
    const form = screen.getByRole("form", { name: "Add an evidence candidate" });
    fireEvent.change(within(form).getByLabelText("Title"), {
      target: { value: "Trust center reference" },
    });
    fireEvent.change(within(form).getByLabelText("Source system"), {
      target: { value: "Trust center" },
    });
    fireEvent.change(within(form).getByLabelText("External URL (optional)"), {
      target: { value: "https://example.com" },
    });
    await user.click(within(form).getByRole("button", { name: "Add evidence candidate" }));

    const item = await screen.findByRole("article", {
      name: "Evidence candidate Trust center reference",
    });
    await user.click(
      within(item).getByLabelText("Edit evidence metadata for Trust center reference"),
    );
    expect(within(item).getByLabelText("Title")).toBeDisabled();
    expect(within(item).getByLabelText("Source system")).toBeDisabled();
    expect(within(item).getByLabelText("External URL (optional)")).toBeDisabled();

    const expectedHash = await sha256Hex(new TextEncoder().encode("https://example.com/"));
    await waitFor(async () => {
      const saved = await store.load((await store.list())[0]!.id);
      expect(saved?.evidence.find(({ title }) => title === "Trust center reference")).toMatchObject(
        {
          externalUrl: "https://example.com/",
          sha256: expectedHash,
        },
      );
    });
  });

  it("retains an attached evidence record and its local bytes in one coordinated state update", async () => {
    const store = new MemoryProjectStore();
    const user = userEvent.setup();
    render(<EvidenceHarness initialProject={initializeProject()} store={store} />);
    const form = screen.getByRole("form", { name: "Add an evidence candidate" });
    fireEvent.change(within(form).getByLabelText("Title"), {
      target: { value: "Local change export" },
    });
    await user.upload(
      within(form).getByLabelText("Local file (optional)"),
      new File(["change,event\n1,approved"], "change-export.csv", { type: "text/csv" }),
    );
    await user.click(within(form).getByRole("button", { name: "Add evidence candidate" }));

    const item = await screen.findByRole("article", {
      name: "Evidence candidate Local change export",
    });
    expect(item).toHaveTextContent("Local file: change-export.csv");
    await waitFor(async () => {
      const saved = await store.load((await store.list())[0]!.id);
      const evidence = saved?.evidence.find(({ title }) => title === "Local change export");
      expect(evidence?.attachmentId).toBeDefined();
      expect(await store.getAttachment(evidence!.attachmentId!)).toBeDefined();
    });
  });

  it("removes mapping and SOC 2 control references from React state and persisted storage", async () => {
    const store = new MemoryProjectStore();
    const project = structuredClone(ACME_METRICS_PROJECT);
    const evidence = project.evidence[0]!;
    project.mappings[0]!.evidenceIds = [evidence.id];
    project.soc2.controls[0]!.evidenceReferences = [evidence.id];
    const user = userEvent.setup();
    render(<EvidenceHarness initialProject={project} store={store} />);

    const item = await screen.findByRole("article", {
      name: `Evidence candidate ${evidence.title}`,
    });
    await user.click(within(item).getByRole("button", { name: "Remove" }));

    await waitFor(async () => {
      const saved = await store.load(project.metadata.id);
      expect(saved?.evidence.some(({ id }) => id === evidence.id)).toBe(false);
      expect(saved?.mappings[0]?.evidenceIds).not.toContain(evidence.id);
      expect(saved?.soc2.controls[0]?.evidenceReferences).not.toContain(evidence.id);
    });
  });
});
