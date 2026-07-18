import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryProjectStore, type ProjectStore } from "@class-a-bridge/project";
import { ACME_METRICS_PROJECT } from "@class-a-bridge/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";

describe("Class A Bridge application shell", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    globalThis.localStorage.clear();
    Object.defineProperty(globalThis.navigator, "onLine", { configurable: true, value: true });
  });

  it("starts without an account and offers exactly the three primary paths", () => {
    render(<App />);
    expect(
      screen.getByRole("button", { name: /start with my SOC 2 report/iu }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start without uploading/iu })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /explore a fictional sample/iu }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Security and privacy" })).toHaveAttribute(
      "href",
      "../security-and-privacy/",
    );
    expect(screen.queryByText(/sign in/iu)).not.toBeInTheDocument();
  });

  it("uses the configured website origin for contact and privacy links", async () => {
    vi.stubEnv("VITE_WEBSITE_URL", "https://classabridge.example.com/");
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("link", { name: "Security and privacy" })).toHaveAttribute(
      "href",
      "https://classabridge.example.com/security-and-privacy/",
    );

    await user.click(screen.getByRole("button", { name: /explore a fictional sample/iu }));
    expect(
      screen.getByRole("link", { name: /request an Ancilis Class A readiness review/iu }),
    ).toHaveAttribute("href", "https://classabridge.example.com/contact/");

    await user.click(screen.getByRole("button", { name: "Project settings" }));
    expect(screen.getByRole("link", { name: "Read privacy documentation" })).toHaveAttribute(
      "href",
      "https://classabridge.example.com/security-and-privacy/",
    );
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
      "SOC 2 reuse",
      "Class A requirements",
      "Evidence",
      "Action plan",
      "Package",
      "Reports",
      "Project settings",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: "SOC 2 reuse" }));
    expect(screen.getByRole("heading", { name: "SOC 2 reuse" })).toBeInTheDocument();
    expect(screen.getAllByText(/Needs expert review/iu).length).toBeGreaterThan(0);
  });

  it("shows unresolved external assessment materials with the preliminary result", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /explore a fictional sample/iu }));
    await user.click(screen.getByRole("button", { name: "Eligibility" }));

    expect(
      screen.getByRole("heading", { name: "Missing external assessment materials" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Verified audit engagement documentation")).toBeInTheDocument();
    expect(screen.getByText("Supplemental compliance evidence")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review SOC 2 materials/iu })).toBeInTheDocument();
  });

  it("lists and opens projects already persisted in the selected browser store", async () => {
    const store = new MemoryProjectStore();
    await store.save(structuredClone(ACME_METRICS_PROJECT));
    const user = userEvent.setup();

    render(<App storeFactory={() => Promise.resolve(store)} />);

    const savedProject = await screen.findByRole("button", {
      name: /open saved project Acme Metrics/iu,
    });
    await user.click(savedProject);
    expect(screen.getByText(/Fictional demonstration/iu)).toBeInTheDocument();
    expect(screen.getByText("Acme Metrics Class A preparation")).toBeInTheDocument();
  });

  it("resumes an interrupted local PDF extraction review from the saved-project picker", async () => {
    const store = new MemoryProjectStore();
    const project = structuredClone(ACME_METRICS_PROJECT);
    project.metadata.isSample = false;
    project.soc2.extractionCandidates = [
      {
        id: "extract-report-issuer",
        field: "Report issuer",
        value: "Suggested Fictional Auditor LLP",
        page: 2,
        snippet: "Fictional source excerpt naming the report issuer.",
        confidence: "medium",
        detector: "Deterministic issuer pattern",
        decision: "unreviewed",
      },
    ];
    project.soc2.issuer = "Prior confirmed issuer";
    await store.save(project);
    const user = userEvent.setup();

    render(<App storeFactory={() => Promise.resolve(store)} />);
    await user.click(
      await screen.findByRole("button", { name: /open saved project Acme Metrics/iu }),
    );

    expect(
      screen.getByRole("heading", { level: 1, name: /Review every suggested report value/iu }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();

    const issuer = screen.getByLabelText("Report issuer");
    await user.clear(issuer);
    await user.type(issuer, "Edited Fictional Auditor LLP");
    await waitFor(async () => {
      const saved = await store.load(project.metadata.id);
      expect(saved?.soc2.extractionCandidates[0]?.value).toBe("Edited Fictional Auditor LLP");
      expect(saved?.soc2.issuer).toBe("Prior confirmed issuer");
    });

    await user.click(screen.getByRole("button", { name: "Mark edited" }));
    await waitFor(async () => {
      const saved = await store.load(project.metadata.id);
      expect(saved?.soc2.extractionCandidates[0]?.decision).toBe("edited");
      expect(saved?.soc2.issuer).toBe("Edited Fictional Auditor LLP");
    });
  });

  it("shows an actionable local-save failure instead of swallowing it", async () => {
    class FailingSaveStore extends MemoryProjectStore {
      override save(): Promise<void> {
        return Promise.reject(new Error("storage quota is unavailable"));
      }
    }
    const store: ProjectStore = new FailingSaveStore();
    const user = userEvent.setup();

    render(<App storeFactory={() => Promise.resolve(store)} />);
    await screen.findByText(/No saved projects are stored/iu);
    await user.click(screen.getByRole("button", { name: /explore a fictional sample/iu }));

    expect(await screen.findByRole("alert", {}, { timeout: 2_000 })).toHaveTextContent(
      /Local save failed.*storage quota is unavailable/iu,
    );
  });

  it("warns that memory storage is session-only and never calls it saved locally", async () => {
    const store = new MemoryProjectStore();
    const user = userEvent.setup();

    render(<App storeFactory={() => Promise.resolve(store)} />);
    await screen.findByText(/No saved projects are stored/iu);
    await user.click(screen.getByRole("button", { name: /explore a fictional sample/iu }));

    expect(
      await screen.findByRole("status", { name: /Session storage warning/iu }),
    ).toHaveTextContent(/Session-only storage.*reload.*lose/iu);
    expect(screen.queryByText(/^Saved locally$/iu)).not.toBeInTheDocument();
  });

  it("deletes active project files and prior localStorage fallback data from settings", async () => {
    const store = new MemoryProjectStore();
    const user = userEvent.setup();
    globalThis.localStorage.setItem("class-a-bridge:project:legacy", "legacy project");
    globalThis.localStorage.setItem("another-app:project", "preserve me");

    render(<App storeFactory={() => Promise.resolve(store)} />);
    await screen.findByText(/No saved projects are stored/iu);
    await user.click(screen.getByRole("button", { name: /explore a fictional sample/iu }));
    await user.click(screen.getByRole("button", { name: "Project settings" }));
    await user.click(screen.getByRole("button", { name: /Review deletion options/iu }));
    const deleteAll = screen.getByRole("button", {
      name: /Delete all Class A Bridge local data/iu,
    });
    await waitFor(() => expect(deleteAll).toBeEnabled());
    await user.click(deleteAll);

    expect(await screen.findByRole("heading", { name: /Turn your SOC 2 Type II/iu })).toBeVisible();
    expect(await store.list()).toEqual([]);
    expect(globalThis.localStorage.getItem("class-a-bridge:project:legacy")).toBeNull();
    expect(globalThis.localStorage.getItem("another-app:project")).toBe("preserve me");
  });

  it("offers backup import on first run, including after local deletion returns there", () => {
    render(<App />);
    expect(screen.getByLabelText(/Choose a Class A Bridge backup/iu)).toHaveAttribute(
      "type",
      "file",
    );
  });

  it("provides a skip link and moves focus to the active route content", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("link", { name: /skip to main content/iu })).toHaveAttribute(
      "href",
      "#main-content",
    );
    await user.click(screen.getByRole("button", { name: /explore a fictional sample/iu }));
    await user.click(screen.getByRole("button", { name: "Eligibility" }));
    await waitFor(() => expect(document.querySelector("#main-content")).toHaveFocus());
  });

  it("announces offline state while preserving the local workspace", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /explore a fictional sample/iu }));

    Object.defineProperty(globalThis.navigator, "onLine", {
      configurable: true,
      value: false,
    });
    await act(() => globalThis.dispatchEvent(new Event("offline")));

    expect(screen.getByRole("status", { name: /connection status/iu })).toHaveTextContent(
      /Offline.*workspace remains available/iu,
    );
  });
});
