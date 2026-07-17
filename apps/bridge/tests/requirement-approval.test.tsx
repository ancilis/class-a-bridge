import { MemoryProjectStore } from "@class-a-bridge/project";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "../src/App";

describe("provider requirement approval", () => {
  it("requires a complete narrative, approved review, named approver, date, and attestation", async () => {
    const user = userEvent.setup();
    render(<App storeFactory={() => Promise.resolve(new MemoryProjectStore())} />);

    await user.click(screen.getByRole("button", { name: /start without uploading/iu }));
    await user.click(screen.getByRole("button", { name: "Class A requirements" }));

    const detail = screen.getByRole("region", { name: "Requirement record" });
    const status = within(detail).getByLabelText("Completion status");
    expect(
      within(status).getByRole("option", { name: /use provider attestation/iu }),
    ).toBeDisabled();

    await user.selectOptions(within(detail).getByLabelText("Review status"), "approved");
    await user.type(
      within(detail).getByLabelText("Provider response"),
      "The provider confirms this draft.",
    );
    await user.type(
      within(detail).getByLabelText("Implementation explanation"),
      "Implemented across the scoped offering.",
    );
    await user.type(
      within(detail).getByLabelText("Verification explanation"),
      "The owner reviews configuration and records results.",
    );
    await user.type(
      within(detail).getByLabelText("Validation explanation"),
      "A dated sample was checked against the stated outcome.",
    );
    await user.type(within(detail).getByLabelText("Provider approver"), "Taylor Jordan");
    await user.type(
      within(detail).getByLabelText("Provider approval date and time"),
      "2026-07-17T14:30",
    );
    await user.click(within(detail).getByLabelText(/I attest that the named provider approver/iu));
    await user.click(within(detail).getByRole("button", { name: "Record provider approval" }));

    expect(within(detail).getAllByText("Approved by provider").length).toBeGreaterThan(0);
    expect(within(detail).getByDisplayValue("Taylor Jordan")).toBeInTheDocument();
  });
});
