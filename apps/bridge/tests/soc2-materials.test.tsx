import { MemoryProjectStore } from "@class-a-bridge/project";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";

describe("manual SOC 2 materials workflow", () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it("lets a manual-start user create a control and a reviewable Class A mapping", async () => {
    const user = userEvent.setup();
    const store = new MemoryProjectStore();
    render(<App storeFactory={() => Promise.resolve(store)} />);

    await user.click(screen.getByRole("button", { name: /start without uploading/iu }));
    await user.click(screen.getByRole("button", { name: "SOC 2 materials" }));

    const controlForm = screen.getByRole("form", { name: "Add a SOC 2 control" });
    await user.type(within(controlForm).getByLabelText("Control identifier"), "CC6.1");
    await user.type(within(controlForm).getByLabelText("Control title"), "Access authorization");
    await user.type(within(controlForm).getByLabelText("Report pages"), "42, 43");
    await user.type(within(controlForm).getByLabelText("Auditor test"), "Sampled access grants");
    await user.type(within(controlForm).getByLabelText("Auditor result"), "No deviations noted");
    await user.click(within(controlForm).getByRole("button", { name: "Add SOC 2 control" }));

    expect(
      screen.getByText("CC6.1 — Access authorization", { selector: "strong" }),
    ).toBeInTheDocument();

    const mappingForm = screen.getByRole("form", { name: "Add a SOC 2 mapping" });
    await user.selectOptions(within(mappingForm).getByLabelText("SOC 2 control"), "CC6.1");
    await user.clear(within(mappingForm).getByLabelText("Report page"));
    await user.type(within(mappingForm).getByLabelText("Report page"), "42");
    await user.selectOptions(within(mappingForm).getByLabelText("Class A rule"), "KSI-IAM-AAM");
    const currentMappingForm = screen.getByRole("form", { name: "Add a SOC 2 mapping" });
    await user.click(
      within(currentMappingForm).getByRole("button", { name: "Add manual mapping" }),
    );

    let mapping = screen.getByRole("article", { name: "CC6.1 to KSI-IAM-AAM mapping" });
    expect(within(mapping).getByLabelText("Mapping confirmed by a person")).not.toBeChecked();
    expect(within(mapping).getByLabelText("Mapping confirmed by a person")).toBeDisabled();
    await user.type(
      within(mapping).getByLabelText("Gap description"),
      "Automation coverage still needs confirmation.",
    );
    await user.selectOptions(
      within(mapping).getByLabelText("Mapping review outcome"),
      "partial_support",
    );
    await user.type(within(mapping).getByLabelText("Reviewer"), "Morgan Lee");
    await user.type(within(mapping).getByLabelText("Review date"), "2026-07-18");
    expect(within(mapping).getByLabelText("Mapping confirmed by a person")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "SOC 2 reuse" }));
    const controlReview = screen.getByRole("article", { name: "CC6.1 SOC 2 control review" });
    await user.click(within(controlReview).getByText("Edit and confirm this control"));
    await user.type(within(controlReview).getByLabelText("Control reviewer"), "Morgan Lee");
    await user.type(within(controlReview).getByLabelText("Control review date"), "2026-07-18");
    await user.click(within(controlReview).getByRole("button", { name: "Confirm control record" }));
    await user.click(screen.getByRole("button", { name: "SOC 2 materials" }));
    mapping = screen.getByRole("article", { name: "CC6.1 to KSI-IAM-AAM mapping" });
    expect(within(mapping).getByLabelText("Mapping confirmed by a person")).toBeEnabled();
    await user.click(within(mapping).getByLabelText("Mapping confirmed by a person"));
    expect(within(mapping).getByLabelText("Mapping confirmed by a person")).toBeChecked();
    expect(within(mapping).getByLabelText("Gap description")).toHaveValue(
      "Automation coverage still needs confirmation.",
    );
    expect(within(mapping).getByLabelText("Reviewer")).toHaveValue("Morgan Lee");

    await user.type(within(mapping).getByLabelText("Reason for the mapping"), " More detail.");
    expect(within(mapping).getByLabelText("Mapping confirmed by a person")).not.toBeChecked();

    const restoredMappingForm = screen.getByRole("form", { name: "Add a SOC 2 mapping" });
    await user.selectOptions(within(restoredMappingForm).getByLabelText("SOC 2 control"), "CC6.1");
    await user.selectOptions(
      within(restoredMappingForm).getByLabelText("Class A rule"),
      "KSI-IAM-AAM",
    );
    await user.click(
      within(restoredMappingForm).getByRole("button", { name: "Add manual mapping" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/already has a mapping record/iu);
  });

  it("captures report context and auditor exceptions without a PDF", async () => {
    const user = userEvent.setup();
    render(<App storeFactory={() => Promise.resolve(new MemoryProjectStore())} />);

    await user.click(screen.getByRole("button", { name: /start without uploading/iu }));
    await user.click(screen.getByRole("button", { name: "SOC 2 materials" }));

    await user.type(
      screen.getByLabelText("Trust Services Criteria (one per line)"),
      "Security{enter}Availability",
    );
    await user.selectOptions(
      screen.getByLabelText("Subservice-organization treatment"),
      "inclusive",
    );
    await user.type(
      screen.getByLabelText("Subservice organizations (one per line)"),
      "Example Cloud Provider",
    );
    await user.type(
      screen.getByLabelText("Bridge or gap letter reference"),
      "Bridge letter dated July 15",
    );

    const exceptionForm = screen.getByRole("form", { name: "Add an auditor exception" });
    await user.type(
      within(exceptionForm).getByLabelText("Exception title"),
      "Delayed deprovisioning",
    );
    await user.type(
      within(exceptionForm).getByLabelText("Exception description"),
      "One sampled account was disabled after the target window.",
    );
    await user.type(within(exceptionForm).getByLabelText("Exception report pages"), "67");
    await user.click(within(exceptionForm).getByRole("button", { name: "Add auditor exception" }));

    expect(screen.getByText("Delayed deprovisioning", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Example Cloud Provider")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Bridge letter dated July 15")).toBeInTheDocument();
  });
});
