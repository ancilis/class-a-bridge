import { createRequire } from "node:module";

// The pinned AJV standalone validators intentionally retain CommonJS `require` calls.
// Scope resolution to the schemas package so this maintainer-only CLI can load the
// exact precompiled validator bytes without rewriting or regenerating them.
globalThis.require = createRequire(new URL("../../schemas/package.json", import.meta.url));
