import { MemoryProjectStore, sha256Hex } from "@class-a-bridge/project";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "../src/App";

describe("evidence metadata", () => {
  it("creates and edits a fully described evidence candidate", async () => {
    const user = userEvent.setup();
    render(<App storeFactory={() => Promise.resolve(new MemoryProjectStore())} />);

    await user.click(screen.getByRole("button", { name: /fictional sample workspace/iu }));
    await user.click(screen.getByRole("button", { name: "Evidence" }));

    const form = screen.getByRole("form", { name: "Add an evidence candidate" });
    await user.type(within(form).getByLabelText("Title"), "Quarterly access review record");
    await user.type(
      within(form).getByLabelText("Description"),
      "Approved user-access review for the production offering.",
    );
    await user.selectOptions(within(form).getByLabelText("Evidence type"), "policy");
    await user.type(within(form).getByLabelText("Source system"), "Governance repository");
    await user.type(within(form).getByLabelText("Owner"), "Identity team");
    await user.clear(within(form).getByLabelText("Collection date"));
    await user.type(within(form).getByLabelText("Collection date"), "2026-07-17");
    await user.type(within(form).getByLabelText("Relevant period"), "2026 Q2");
    await user.clear(within(form).getByLabelText("Review or expiration date"));
    await user.type(within(form).getByLabelText("Review or expiration date"), "2026-10-17");
    await user.selectOptions(within(form).getByLabelText("Sensitivity"), "restricted");
    await user.type(
      within(form).getByLabelText("Notes"),
      "Evidence candidate pending reviewer confirmation.",
    );
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
    await user.clear(description);
    await user.type(description, "Updated reviewer-approved description.");
    expect(description).toHaveValue("Updated reviewer-approved description.");
  });

  it("hashes a normalized external reference and locks its hash identity", async () => {
    const store = new MemoryProjectStore();
    const user = userEvent.setup();
    render(<App storeFactory={() => Promise.resolve(store)} />);

    await user.click(screen.getByRole("button", { name: /start without uploading/iu }));
    await user.click(screen.getByRole("button", { name: "Evidence" }));
    const form = screen.getByRole("form", { name: "Add an evidence candidate" });
    await user.type(within(form).getByLabelText("Title"), "Trust center reference");
    await user.type(within(form).getByLabelText("Source system"), "Trust center");
    await user.type(within(form).getByLabelText("External URL (optional)"), "https://example.com");
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
});
