import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Callout, Card, ProgressTrack, StatusPill } from "../src/index";

describe("shared accessible components", () => {
  it("exposes status and progress without relying on color", () => {
    render(
      <>
        <StatusPill tone="warning">Needs review</StatusPill>
        <ProgressTrack current={3} total={8} label="Eligibility questions" />
      </>,
    );
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
    expect(screen.getByText("3 of 8")).toBeInTheDocument();
  });

  it("uses semantic regions for cards and callouts", () => {
    render(
      <Card title="Current status">
        <Callout title="Private workspace">Local only</Callout>
      </Card>,
    );
    expect(screen.getByRole("region", { name: "Current status" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Local only");
  });
});
