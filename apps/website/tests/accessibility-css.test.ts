import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function color(variable: string): string {
  const match = css.match(new RegExp(`--${variable}:\\s*(#[0-9a-f]{6})`, "iu"));
  if (!match?.[1]) throw new Error(`Missing CSS color token: ${variable}`);
  return match[1];
}

function luminance(hex: string): number {
  const components = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const linear = components.map((component) => {
    const channel = component / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrast(first: string, second: string): number {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("website color tokens", () => {
  it("keeps subtle text at WCAG AA contrast on every surface that uses it", () => {
    const foreground = color("subtle");

    for (const background of [color("canvas"), color("surface"), color("surface-tint")]) {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
