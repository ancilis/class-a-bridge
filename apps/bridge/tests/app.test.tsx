import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "../src/App";

describe("Class A Bridge application shell", () => {
  it("starts without an account and offers exactly the three primary paths", () => {
    render(<App />);
    expect(
      screen.getByRole("button", { name: /start with my SOC 2 report/iu }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start without uploading/iu })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /explore a fictional sample/iu }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/sign in/iu)).not.toBeInTheDocument();
  });

  it("opens a useful fictional workspace with privacy and navigation labels", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /explore a fictional sample/iu }));
    expect(
      screen.getByText(
        (_content, element) =>
          element?.classList.contains("privacy-indicator") === true &&
          element.textContent?.includes("project data stays in this browser") === true,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Fictional demonstration — not an actual certification package/iu),
    ).toBeInTheDocument();
    for (const label of [
      "Overview",
      "Eligibility",
      "Scope",
      "SOC 2 materials",
      "Class A requirements",
      "Evidence",
      "Action plan",
      "Package",
      "Reports",
      "Project settings",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getAllByText(/Needs expert review/iu).length).toBeGreaterThan(0);
  });
});
