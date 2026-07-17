import { MemoryProjectStore } from "@class-a-bridge/project";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "../src/App";

describe("scope relationship builder", () => {
  it("records a plain-language relationship between inventoried resources", async () => {
    const user = userEvent.setup();
    render(<App storeFactory={() => Promise.resolve(new MemoryProjectStore())} />);

    await user.click(screen.getByRole("button", { name: /fictional sample workspace/iu }));
    await user.click(screen.getByRole("button", { name: "Scope" }));

    const form = screen.getByRole("form", { name: "Add a scope relationship" });
    await user.selectOptions(within(form).getByLabelText("From resource"), "scope-marketing");
    await user.selectOptions(within(form).getByLabelText("Relationship"), "depends_on");
    await user.selectOptions(within(form).getByLabelText("To resource"), "scope-cloud");
    await user.type(
      within(form).getByLabelText("Relationship description"),
      "Application security events are forwarded for review.",
    );
    await user.click(within(form).getByRole("button", { name: "Add relationship" }));

    const relationship = screen.getByRole("article", {
      name: "Marketing website depends on Fictional Cloud Host relationship",
    });
    expect(relationship).toHaveTextContent("Application security events are forwarded for review.");
    expect(within(relationship).getByRole("button", { name: "Remove relationship" })).toBeEnabled();
  });
});
