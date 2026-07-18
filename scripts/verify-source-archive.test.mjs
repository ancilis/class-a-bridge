import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { runVerificationCommand } from "./verify-source-archive.mjs";

test("prints child output when a source-archive verification command fails", async () => {
  const stdout = [];
  const stderr = [];
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  process.stdout.write = (chunk) => {
    stdout.push(String(chunk));
    return true;
  };
  process.stderr.write = (chunk) => {
    stderr.push(String(chunk));
    return true;
  };

  try {
    await assert.rejects(
      () =>
        runVerificationCommand(
          process.execPath,
          [
            "-e",
            "process.stdout.write(Buffer.from('dmlzaWJsZSBzdGRvdXQK','base64')); process.stderr.write(Buffer.from('dmlzaWJsZSBzdGRlcnIK','base64')); process.exit(7)",
          ],
          path.resolve("."),
        ),
      (error) => error?.code === 7,
    );
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }

  assert.match(stdout.join(""), /visible stdout/iu);
  assert.match(stderr.join(""), /visible stderr/iu);
});
