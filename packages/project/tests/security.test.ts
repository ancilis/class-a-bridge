import { describe, expect, it } from "vitest";

import { csvCell, decryptBundle, encryptBundle, safeFilename, sha256Hex } from "../src/index";

describe("portable-file security", () => {
  it("hashes bytes with SHA-256", async () => {
    expect(await sha256Hex(new TextEncoder().encode("bridge"))).toBe(
      "17f29b073143d8cd97b5bbe492bdeffec1c5fee55cc1fe2112c8b9335f8b6121",
    );
  });

  it("creates safe deterministic filenames", () => {
    expect(safeFilename("../../ SOC 2: Q4?.pdf")).toBe("SOC 2- Q4.pdf");
    expect(safeFilename("...")).toBe("class-a-bridge-file");
  });

  it.each(["=1+1", " +SUM(A1:A2)", "\t@cmd", "\r-10"])(
    "escapes CSV formula payload %j",
    (value) => {
      expect(csvCell(value)).toContain("'");
    },
  );

  it("encrypts locally and fails closed for wrong passwords or tampering", async () => {
    const input = new TextEncoder().encode("private project canary");
    const encrypted = await encryptBundle(input, "correct horse battery staple", {
      iterations: 10_000,
    });
    expect(new TextDecoder().decode(encrypted)).not.toContain("private project canary");
    await expect(decryptBundle(encrypted, "correct horse battery staple")).resolves.toEqual(input);
    await expect(decryptBundle(encrypted, "wrong password")).rejects.toThrow(/unable to decrypt/iu);
    const tampered = encrypted.slice();
    tampered[tampered.length - 3] = (tampered[tampered.length - 3] ?? 0) ^ 1;
    await expect(decryptBundle(tampered, "correct horse battery staple")).rejects.toThrow(
      /unable to decrypt/iu,
    );
  });
});
