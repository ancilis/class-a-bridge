import { describe, expect, it } from "vitest";

import viteConfig from "../vite.config";

describe("Bridge production configuration", () => {
  it("does not emit source maps into the public application build", () => {
    expect(viteConfig).toMatchObject({
      build: {
        sourcemap: false,
      },
    });
  });
});
