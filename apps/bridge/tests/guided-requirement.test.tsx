import { MemoryProjectStore } from "@class-a-bridge/project";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "../src/App";

describe("guided requirement workspace", () => {
  it("defaults to plain-language guided mode and preserves edits when switching to record mode", async () => {
    const user = userEvent.setup();
    render(<App storeFactory={() => Promise.resolve(new MemoryProjectStore())} />);

    await user.click(screen.getByRole("button", { name: /start without uploading/iu }));
    await user.click(screen.getByRole("button", { name: "Class A requirements" }));

    expect(screen.getByRole("button", { name: "Guided mode" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText(/Guided task 1 of 9/iu)).toBeVisible();
    expect(screen.getByText(/Ancilis guidance.*not official FedRAMP text/iu)).toBeVisible();
    expect(screen.getByText(/Content review status: Draft/iu)).toBeVisible();
    expect(
      screen.getByRole("heading", { name: /Official Class A classification/iu }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Next: identify the owner/iu }));
    await user.clear(screen.getByLabelText("Likely owner"));
    await user.type(screen.getByLabelText("Likely owner"), "Compliance program lead");

    await user.click(screen.getByRole("button", { name: "Record mode" }));
    const record = screen.getByRole("region", { name: "Requirement record" });
    expect(within(record).getByLabelText("Owner")).toHaveValue("Compliance program lead");

    await user.click(screen.getByRole("button", { name: "Guided mode" }));
    expect(screen.getByLabelText("Likely owner")).toHaveValue("Compliance program lead");
  });
});
