import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createEmptyProject, MemoryProjectStore } from "@class-a-bridge/project";
import { expect, it } from "vitest";
import { App } from "../src/App";

it("opens a July project and reconciles only after the explicit update action", async () => {
  const project = createEmptyProject("July backup", "Fictional provider");
  project.metadata.ruleCatalogVersion = "2026.07.14.01";
  project.requirements = project.requirements.filter((row) => row.ruleId !== "SDR-CSX-KSI");
  project.requirements[0]!.implementationNarrative = "Preserved customer narrative";
  const store = new MemoryProjectStore();
  await store.save(project);
  render(<App storeFactory={() => Promise.resolve(store)} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: /Open saved project July backup/iu }));
  expect(screen.getByText("Review the catalog update", { exact: true })).toBeVisible();
  expect((await store.load(project.metadata.id))?.metadata.ruleCatalogVersion).toBe(
    "2026.07.14.01",
  );
  await user.click(screen.getByRole("button", { name: "Update catalog and reopen reviews" }));
  await waitFor(async () => {
    const saved = await store.load(project.metadata.id);
    expect(saved?.metadata.ruleCatalogVersion).toBe("2026.11.02.01");
    expect(saved?.requirements.some((row) => row.ruleId === "SDR-CSX-KSI")).toBe(true);
    expect(saved?.requirements[0]?.implementationNarrative).toBe("Preserved customer narrative");
  });
  expect(
    screen.queryByRole("button", { name: "Update catalog and reopen reviews" }),
  ).not.toBeInTheDocument();
});
