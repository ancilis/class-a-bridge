import { SOC2_CONTROL_CSV_MAX_BYTES, type BridgeProject } from "@class-a-bridge/project";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Soc2Reuse } from "../src/features/soc2/Soc2Reuse";
import { initializeProject } from "../src/lib/workspace";

const candidateProject = () => {
  const project = initializeProject("2026-07-18T12:00:00.000Z");
  project.offering.name = "Acme Metrics Cloud";
  project.soc2.reportStart = "2025-07-01";
  project.soc2.reportEnd = "2026-06-30";
  project.soc2.controls.push({
    id: "ACME-CC6.1",
    title: "Automated account provisioning and deprovisioning",
    description: "Identity lifecycle automation covers account creation and removal.",
    trustServicesCriteria: ["CC6.1", "CC6.2"],
    reportPages: [42],
    auditorTest: "Inspected account provisioning and deprovisioning samples.",
    auditorResult: "No deviations noted.",
    exceptionIds: [],
    excerpt: "Fictional account-lifecycle control excerpt.",
    exceptionStatus: "no_exception_reported",
    confirmationStatus: "confirmed",
    reviewer: "Morgan Lee",
    reviewDate: "2026-07-18",
    scopeAlignment: "aligned",
    systemScope: project.offering.name,
    reportPeriodStart: project.soc2.reportStart,
    reportPeriodEnd: project.soc2.reportEnd,
  });
  return project;
};

function Harness({ initial = candidateProject() }: { readonly initial?: BridgeProject }) {
  const [project, setProject] = useState(initial);
  return (
    <Soc2Reuse
      project={project}
      update={(recipe) =>
        setProject((current) => {
          const next = structuredClone(current);
          recipe(next);
          return next;
        })
      }
    />
  );
}

describe("SOC 2 reuse workspace", () => {
  it("lets a compliance owner edit and explicitly confirm an inventory control", async () => {
    const user = userEvent.setup();
    const project = candidateProject();
    project.soc2.controls[0]!.confirmationStatus = "unreviewed";
    project.soc2.controls[0]!.reviewer = undefined;
    project.soc2.controls[0]!.reviewDate = undefined;
    render(<Harness initial={project} />);

    const control = screen.getByRole("article", { name: "ACME-CC6.1 SOC 2 control review" });
    expect(within(control).getByText("Needs control review")).toBeVisible();
    await user.click(within(control).getByText("Edit and confirm this control"));
    await user.clear(within(control).getByLabelText("Control title"));
    await user.type(within(control).getByLabelText("Control title"), "Reviewed access lifecycle");
    await user.type(within(control).getByLabelText("Control reviewer"), "Morgan Lee");
    await user.type(within(control).getByLabelText("Control review date"), "2026-07-18");
    await user.click(within(control).getByRole("button", { name: "Confirm control record" }));

    expect(within(control).getByText("Control reviewed")).toBeVisible();
    expect(within(control).getByLabelText("Control title")).toHaveValue(
      "Reviewed access lifecycle",
    );
  });

  it("invalidates supporting mapping decisions when the source control changes", async () => {
    const user = userEvent.setup();
    const project = candidateProject();
    project.mappings.push({
      id: "mapping-reviewed-support",
      soc2ControlId: "ACME-CC6.1",
      reportPage: 42,
      excerpt: "Fictional account-lifecycle control excerpt.",
      classARuleId: "KSI-IAM-AAM",
      coverage: "partially_covered",
      reason: "Reviewed partial support.",
      gapDescription: "Confirm federal account sources.",
      additionalEvidenceNeeded: "Current account inventory.",
      suggested: true,
      confirmed: true,
      reviewOutcome: "partial_support",
      reviewer: "Morgan Lee",
      reviewDate: "2026-07-18",
    });
    render(<Harness initial={project} />);

    const control = screen.getByRole("article", { name: "ACME-CC6.1 SOC 2 control review" });
    await user.click(within(control).getByText("Edit and confirm this control"));
    await user.type(within(control).getByLabelText("Control title"), " updated");

    const mapping = screen.getByRole("article", {
      name: "ACME-CC6.1 to KSI-IAM-AAM mapping review",
    });
    expect(within(mapping).getByText("Needs user confirmation")).toBeVisible();
    expect(within(mapping).getByText(/reconfirm this mapping after reviewing/iu)).toBeVisible();
  });

  it("adds an explained deterministic suggestion for review without completing a requirement", async () => {
    const user = userEvent.setup();
    const project = candidateProject();
    const originalStatus = project.requirements.find(
      ({ ruleId }) => ruleId === "KSI-IAM-AAM",
    )!.status;
    render(<Harness initial={project} />);

    expect(screen.getByText(/does not apply a universal crosswalk/iu)).toBeInTheDocument();
    expect(
      screen.getByText(/Ancilis draft guidance.*not official FedRAMP text/iu),
    ).toBeInTheDocument();

    const suggestion = screen.getByRole("article", {
      name: /ACME-CC6\.1 to KSI-IAM-AAM suggestion/iu,
    });
    expect(within(suggestion).getByText(/Trust Services Criteria CC6\.1/iu)).toBeVisible();
    expect(within(suggestion).getByText(/Scope alignment/iu)).toBeVisible();
    expect(within(suggestion).getByText(/Audit period/iu)).toBeVisible();
    expect(within(suggestion).getByText("Auditor result", { selector: "dt" })).toBeVisible();
    expect(within(suggestion).getByText(/Exception status/iu)).toBeVisible();
    expect(
      within(suggestion).getByText("Fictional account-lifecycle control excerpt."),
    ).toBeVisible();
    await user.click(within(suggestion).getByRole("button", { name: /Review this candidate/iu }));

    const review = screen.getByRole("article", {
      name: /ACME-CC6\.1 to KSI-IAM-AAM mapping review/iu,
    });
    expect(within(review).getByText(/Needs user confirmation/iu)).toBeVisible();
    expect(within(review).getByTestId("related-requirement-status")).toHaveTextContent(
      new RegExp(originalStatus.replaceAll("_", " "), "iu"),
    );
  });

  it("requires a named reviewer and date before confirming or rejecting a mapping", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const suggestion = screen.getByRole("article", {
      name: /ACME-CC6\.1 to KSI-IAM-AAM suggestion/iu,
    });
    await user.click(within(suggestion).getByRole("button", { name: /Review this candidate/iu }));

    const review = screen.getByRole("article", {
      name: /ACME-CC6\.1 to KSI-IAM-AAM mapping review/iu,
    });
    await user.selectOptions(
      within(review).getByLabelText("Mapping review outcome"),
      "partial_support",
    );
    await user.click(within(review).getByRole("button", { name: "Confirm mapping" }));
    expect(within(review).getByRole("alert")).toHaveTextContent(/reviewer and review date/iu);

    await user.type(within(review).getByLabelText("Reviewer"), "Morgan Lee");
    await user.type(within(review).getByLabelText("Review date"), "2026-07-18");
    await user.click(within(review).getByRole("button", { name: "Confirm mapping" }));
    expect(
      within(review).getByText("Reviewed: Partial support", { selector: ".status" }),
    ).toBeVisible();

    await user.selectOptions(
      within(review).getByLabelText("Mapping review outcome"),
      "rejected_mapping",
    );
    expect(
      within(review).getByText("Needs user confirmation", { selector: ".status" }),
    ).toBeVisible();

    await user.click(within(review).getByRole("button", { name: "Reject mapping" }));
    expect(
      within(review).getByText("Reviewed: Rejected mapping", { selector: ".status" }),
    ).toBeVisible();
    expect(
      within(review).getByText("Rejected mapping", { selector: ".soc2-reuse__decision strong" }),
    ).toBeVisible();
    expect(
      within(review).getByText(/Reviewed decision; it does not establish support/iu),
    ).toBeVisible();
  });

  it("imports pasted controls and exposes local templates, inventory exports, and reuse reports", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole("button", { name: "Download CSV template" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export control inventory CSV" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Download reuse report HTML" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Download mapping matrix CSV" })).toBeEnabled();

    const template = [
      "Control identifier,Control title,Control description,Trust Services Criteria,Report pages,Source excerpt,Auditor test procedure,Auditor test result,Exception status,Exception description,Remediation status,Report period start,Report period end,Control frequency,Control owner,System or service scope,Environment,Subservice organization,Inclusive or carve-out treatment,Complementary user-entity control,Complementary subservice-organization control,Evidence references,User confirmation status,Reviewer,Review date,Notes",
      "ACME-CC7.4,Incident response execution,Incident handling and recovery,CC7.4,88,Fictional excerpt,Inspected incident samples,No deviations noted,no_exception_reported,,,2025-07-01,2026-06-30,Per incident,Security Operations,Acme Metrics Cloud,Production,,inclusive,,,,unreviewed,,,Imported locally",
    ].join("\n");
    await user.type(screen.getByLabelText("Paste SOC 2 control CSV or tabular data"), template);
    await user.click(screen.getByRole("button", { name: "Import pasted controls" }));

    expect(screen.getByRole("status", { name: "SOC 2 import result" })).toHaveTextContent(
      /Imported 1 control/iu,
    );
    expect(screen.getByText(/ACME-CC7\.4 — Incident response execution/iu)).toBeVisible();

    const fileRows = template.replace(
      /ACME-CC7\.4,Incident response execution/gu,
      "ACME-CC4.1,Security monitoring review",
    );
    await user.upload(
      screen.getByLabelText("Choose local CSV"),
      new File([fileRows], "soc2-controls.csv", { type: "text/csv" }),
    );
    expect(screen.getByRole("status", { name: "SOC 2 import result" })).toHaveTextContent(
      /Imported 1 control/iu,
    );
    expect(screen.getByText(/ACME-CC4\.1 — Security monitoring review/iu)).toBeVisible();
  });

  it("rejects an oversized CSV before reading its contents", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const file = new File([""], "oversized.csv", { type: "text/csv" });
    Object.defineProperty(file, "size", { value: SOC2_CONTROL_CSV_MAX_BYTES + 1 });

    await user.upload(screen.getByLabelText("Choose local CSV"), file);

    expect(screen.getByText(/exceeds the 5 MB import limit/iu)).toBeVisible();
    expect(screen.getByText("No controls were imported.")).toBeVisible();
  });
});
