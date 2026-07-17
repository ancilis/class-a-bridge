import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import HomePage from "../app/page";

describe("assessment application URLs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the configured app origin on the homepage", () => {
    vi.stubEnv("NEXT_PUBLIC_BRIDGE_APP_URL", "https://bridge.example.com/");

    const markup = renderToStaticMarkup(<HomePage />);

    expect(markup).toContain('href="https://bridge.example.com/?start=sample"');
  });

  it("uses the configured app origin for all three launch cards", async () => {
    vi.stubEnv("NEXT_PUBLIC_BRIDGE_APP_URL", "https://bridge.example.com/");
    vi.resetModules();
    const { default: LaunchPage } = await import("../app/launch/page");

    const markup = renderToStaticMarkup(<LaunchPage />);

    expect(markup.match(/href="https:\/\/bridge\.example\.com\/\?start=/gu)).toHaveLength(3);
  });
});
