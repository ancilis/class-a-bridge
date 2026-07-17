# Maintainer guide

## Development baseline

Class A Bridge is a pnpm/Turborepo monorepo using Node.js 24, pnpm 10.33.0, strict TypeScript, React, a static Next.js website, a Vite PWA, Zod project boundaries, browser Web Crypto/IndexedDB, precompiled AJV validators, and Vitest/browser quality gates.

```sh
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
pnpm verify
```

Do not use real assessment data in development. Acme Metrics is the only demonstration dataset and must remain fictional/watermarked.

## Dependency direction

Keep low-level packages free of application imports. `project` owns data/security; `documents` consumes validated project snapshots; apps compose packages. The bridge never imports `contact-api`. The contact handler never imports `project`. The website cannot read bridge storage.

A new dependency requires need, license, provenance, bundle/runtime, maintenance, vulnerability, and lockfile review. Runtime remote code, remote fonts, analytics, dynamic code evaluation, and remote document processing violate the 1.0 baseline unless governance approves a new architecture/privacy model.

## Tests and change discipline

Write the test first for behavior changes and observe the expected failure. Test public behavior and negative/security boundaries. Run the narrow package test during development, then the full clean gate:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:a11y
pnpm test:e2e
```

Security-sensitive changes also run [SECURITY_TESTING.md](../security/SECURITY_TESTING.md). UI changes require keyboard, focus, semantics, screen reader, contrast, reduced-motion, zoom, print, and responsive review. Content changes use [CONTENT_AND_ACCESSIBILITY.md](CONTENT_AND_ACCESSIBILITY.md).

## Project schema and migrations

`BridgeProjectSchema` is the trust boundary. Keep nested schemas strict. When changing persisted shape:

1. decide whether the change is backward compatible;
2. increment the project schema version when needed;
3. add a pure migration from every supported prior version;
4. validate the migrated object before storage mutation;
5. add old/current/future/unknown-field/corrupt tests;
6. test export/delete/import equality and advisor redaction;
7. update architecture, end-user guidance, release notes, and sample fixture.

Never use a migration to infer provider approval, complete requirements, or reinterpret a prior answer silently.

## Files, archives, cryptography, and documents

Treat filenames, MIME declarations, bytes, archive metadata, project strings, schema inputs, and imported versions as attacker-controlled. Preserve size/count/ratio/path/hash checks. ZIP content stays in memory; do not extract to disk. Serializer escaping is output-context specific.

Do not change PBKDF2/AES-GCM parameters or envelope format without test vectors, compatibility design, and security review. Do not log plaintext, passwords, keys, filenames, or contact bodies.

## Rules and schemas

Follow [RULES_AND_SCHEMAS.md](RULES_AND_SCHEMAS.md). Run the non-mutating `pnpm rules:compare` and `pnpm schemas:compare` source checks. Candidate retrieval, byte application, product-guidance review, and release approval are separate steps. A change in an official source is not permission to silently change Ancilis interpretation. Preserve unresolved inconsistencies with a clear “Needs FedRAMP confirmation” note.

## Website and contact

The public site is statically generated with reusable content records, unique metadata, sitemap/robots, and structured data. Avoid invented customers, metrics, testimonials, logos, case studies, certification, or endorsement claims.

The contact form creates an allowlisted payload from form state. The optional handler accepts seven fields only. Adding an attachment/project/answer/evidence field is an architecture and privacy change, not a routine form enhancement. Multi-instance deployment needs a shared rate-limit implementation.

## Releases

1. Freeze feature/regulatory scope.
2. Update version, changelog, release notes, official manifests, and known limitations.
3. Run frozen install and full verification from a clean checkout.
4. Execute security, privacy-canary, accessibility, cross-browser, offline/PWA, link, print, import/export, and host-header checks.
5. Generate screenshots from the exact working build with visible fictional watermark where sample data appears.
6. Complete [RELEASE_CHECKLIST.md](../release/RELEASE_CHECKLIST.md) with evidence links/output.
7. Obtain independent maintainer review and create the signed/annotated tag according to repository policy.
8. Deploy immutable outputs, smoke test production, record build locations/commit, then announce.

Rollback changes static assets only. Preserve browser-schema compatibility. Security advisories follow [SECURITY.md](../../SECURITY.md).
