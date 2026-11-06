import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { createEmptyProject, evaluateEligibility } from "@class-a-bridge/project";
import { StartingPlan } from "../src/features/eligibility/StartingPlan";
import { Soc2Reuse } from "../src/features/soc2/Soc2Reuse";

it("offers an immediate plan download and a concrete next task", async () => {
  const project = createEmptyProject("Starting", "Example");
  const answers = {
    soc2_type_ii: "yes",
    soc2_fresh: "yes",
    product_match: "yes",
    federal_differs: "no",
    carved_out: "yes",
    material_exceptions: "no",
    cloud_service: "yes",
    federal_use_case: "yes",
  } as const;
  project.eligibility.answers = Object.entries(answers).map(([questionId, value]) => ({
    questionId: questionId as keyof typeof answers,
    value,
    answeredAt: new Date().toISOString(),
  }));
  project.eligibility.result = evaluateEligibility(answers);
  const navigate = vi.fn();
  render(<StartingPlan project={project} update={vi.fn()} navigate={navigate} />);
  expect(screen.getByRole("button", { name: "Download your starting plan" })).toBeEnabled();
  expect(screen.getByText("Compliance and cloud operations")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: /Continue: Review the providers/iu }));
  expect(navigate).toHaveBeenCalledWith("/scope");
  expect(screen.getByText(/Browser storage can be cleared/iu)).toBeVisible();
});

it("does not represent an empty inventory as zero assessed gaps", () => {
  const project = createEmptyProject("Empty", "Example");
  render(<Soc2Reuse project={project} update={vi.fn()} />);
  expect(screen.getByText("Reuse assessment not started")).toBeVisible();
  expect(screen.getByText(/Import your first control/iu)).toBeVisible();
  expect(screen.queryByText("FedRAMP-specific gaps", { exact: true })).not.toBeInTheDocument();
});
