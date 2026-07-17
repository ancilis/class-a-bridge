import { MemoryProjectStore } from "@class-a-bridge/project";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "../src/App";

describe("provider and offering profile", () => {
  it("lets a manual-start provider populate every CPO source field outside advanced package data", async () => {
    const user = userEvent.setup();
    render(<App storeFactory={() => Promise.resolve(new MemoryProjectStore())} />);

    await user.click(screen.getByRole("button", { name: /start without uploading/iu }));
    await user.click(screen.getByRole("button", { name: "Project settings" }));

    await user.clear(screen.getByLabelText("Organization"));
    await user.type(screen.getByLabelText("Organization"), "Example Provider");
    await user.type(screen.getByLabelText("Organization website"), "https://provider.example/");
    await user.type(screen.getByLabelText("GRC owner"), "Alex Morgan");
    await user.type(screen.getByLabelText("Trust center URL"), "https://trust.provider.example/");
    await user.selectOptions(screen.getByLabelText("Marketplace listing status"), "preparing");
    await user.clear(screen.getByLabelText("Cloud service offering"));
    await user.type(screen.getByLabelText("Cloud service offering"), "Example Cloud");
    await user.type(screen.getByLabelText("Offering acronym"), "EXC");
    await user.type(
      screen.getByLabelText("Offering description"),
      "Hosted analytics service for federal program teams.",
    );
    await user.click(screen.getByLabelText("Software as a Service (SaaS)"));
    await user.selectOptions(screen.getByLabelText("Deployment model"), "Public Cloud");
    await user.selectOptions(screen.getByLabelText("Handles federal customer data"), "yes");
    await user.type(screen.getByLabelText("Offering website"), "https://cloud.provider.example/");

    expect(screen.getByLabelText("Offering description")).toHaveValue(
      "Hosted analytics service for federal program teams.",
    );
    expect(screen.getByLabelText("Software as a Service (SaaS)")).toBeChecked();
    expect(screen.getByLabelText("Trust center URL")).toHaveValue(
      "https://trust.provider.example/",
    );
  });
});
