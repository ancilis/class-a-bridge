# Contact API security verification

**Date:** 2026-07-18  
**Release:** Class A Bridge 0.9.0 Public Beta  
**Source baseline:** `e490a3c856073f1fe4b9703f2ffc0c59d43e4601` plus the release-hardening working tree  
**Toolchain:** Node.js 24.18.0; pnpm 10.33.0  
**Scope:** `apps/contact-api`, its Cloudflare Worker configuration, and `docs/deployment/CONTACT_API.md`

## Result

The focused contact-boundary verification passed. The compiled handler accepts only the seven documented contact keys, rejects unknown project/document keys, enforces JSON and a 16 KiB streaming limit, restricts browser origins and preflight headers, rate-limits by an adapter-provided client key, emits event-only logs, and delivers only the validated contact record to an operator-configured HTTPS webhook.

This is not a live-deployment attestation. Provider WAF behavior, proxy logging, webhook access/retention, DNS controls, TLS, and cross-replica throttling still require operator verification.

## Defects corrected

1. Replaced `max-age=63072000; includeSubDomains; preload` with the documented host-scoped `max-age=31536000`. Domain-wide HTTPS and preload readiness are no longer implied.
2. Added `form-action 'none'` to the response Content Security Policy.
3. Rejected CORS preflights that request any header other than `Content-Type`.
4. Reused the complete restrictive header baseline for Worker configuration-failure responses.
5. Rejected fractional, non-finite, and unsafe rate-limit configuration values.
6. Capped the configurable in-memory rate-limit key bound at 100,000 (default 10,000).

## Verified controls

| Boundary                  | Evidence                                                                                                                                                                       | Result                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Accepted schema           | Required/optional field validation for `name`, `email`, `company`, `role`, `message`, `approvedSummary`, and honeypot `website`                                                | Passed                                   |
| Unknown-field rejection   | Individual canaries for `answers`, `attachments`, `controlExcerpt`, `evidence`, `internalNotes`, `package`, `project`, `reportText`, `requirements`, `scope`, and `soc2Report` | Passed; zero delivery                    |
| Project-package isolation | Package has no runtime dependencies and source has no import path to project, document, rule, or schema packages                                                               | Passed                                   |
| Body safety               | JSON-only media type, strict UTF-8 decoding, declared and streamed 16 KiB limit, malformed JSON rejection, control-character rejection                                         | Passed                                   |
| Browser boundary          | Exact origin allowlist, POST/OPTIONS only, fixed path, no query, narrow preflight method/header allowlist                                                                      | Passed                                   |
| Rate limiting             | Fail-closed store behavior; bounded key-count configuration; Worker limit produced statuses `202, 202, 202, 202, 202, 429` for one key                                         | Passed for a single store/Worker isolate |
| Spam handling             | Filled honeypot returns the normal accepted response without delivery                                                                                                          | Passed                                   |
| Logs and errors           | Typed event-only logs; delivery and rate-store errors do not expose contact values or provider details                                                                         | Passed                                   |
| Webhook delivery          | HTTPS only, URL credentials rejected, redirects disabled, timeout bounded, non-success response fails closed                                                                   | Passed                                   |
| Headers                   | No-store, CSP, CORP, permissions policy, no-referrer, host-scoped HSTS, no-sniff, frame denial, `Vary: Origin`                                                                 | Passed                                   |
| Startup failure           | Worker 503 response uses the same restrictive headers and generic body                                                                                                         | Passed                                   |
| Build disclosure          | No source maps, source-map references, local paths, HSTS preload, or `includeSubDomains` in compiled output                                                                    | Passed                                   |
| Cloudflare configuration  | Observability disabled; public origin only in `vars`; webhook URL/token remain deployment secrets                                                                              | Inspected                                |

## Verification commands and results

```text
pnpm exec prettier --check apps/contact-api/src/index.ts apps/contact-api/src/worker.ts apps/contact-api/tests/contact.test.ts apps/contact-api/tests/worker.test.ts apps/contact-api/tests/production-config.test.ts apps/contact-api/README.md docs/deployment/CONTACT_API.md reports/release/contact-security-verification.md
Result: passed; all matched files use Prettier style.

pnpm --filter @class-a-bridge/contact-api lint
Result: passed; 0 errors.

pnpm --filter @class-a-bridge/contact-api typecheck
Result: passed; 0 TypeScript errors.

pnpm --filter @class-a-bridge/contact-api test
Result: passed; 3 files, 60 tests, 0 failures.

rm -rf apps/contact-api/dist
pnpm --filter @class-a-bridge/contact-api build
Result: passed from a removed generated output directory.

find apps/contact-api/dist -type f -maxdepth 2 -print | sort
Result: index.js, index.d.ts, worker.js, worker.d.ts only.

if rg -n 'preload|includeSubDomains|sourceMappingURL|/Users/|/home/' apps/contact-api/dist; then exit 1; fi
Result: passed; no match.

node --input-type=module -e '<compiled contact handler smoke test>'
Result: {"accepted":202,"rejected":400,"deliveries":1,"hsts":"max-age=31536000"}.

git diff --check -- apps/contact-api docs/deployment/CONTACT_API.md reports/release/contact-security-verification.md
Result: passed.
```

All pnpm/Node commands used `PATH=/opt/homebrew/opt/node@24/bin:$PATH` to select the repository-pinned Node.js major.

## Compiled artifact checksums

| File                                | SHA-256                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| `apps/contact-api/dist/index.d.ts`  | `e501eac89e76bbb6bba328dc39840ef1ffe1286cf1db3121606d53b265934ac1` |
| `apps/contact-api/dist/index.js`    | `97f169eae94a926698b2b2a1560a25ef78401a18523e4c8ec43ce089a4c13b3f` |
| `apps/contact-api/dist/worker.d.ts` | `caeb12841a93d993157cd090266e8d7e48a643536c8c9d3eef3ca622eb1216fd` |
| `apps/contact-api/dist/worker.js`   | `a3025eaeae5f8ac93b9aabb4e1c0e3470c68cc644e92c7234f04db7a9bf86e6c` |

These checksums describe this working-tree build and will change if release integration changes the compiled sources.

## Honest limitations and operator actions

- `MemoryRateLimitStore` is bounded but isolate/process-local. A multi-instance deployment needs an atomic shared limiter or provider WAF/rate limiting and a global abuse ceiling.
- The handler trusts the adapter to derive the client key from a platform-authenticated address signal. A public forwarding header must not be trusted.
- The endpoint intentionally transmits user-submitted contact details and an optional manually approved high-level summary to the configured webhook. It does not accept attachments or project structures; semantic review of the optional summary remains a user/operator responsibility.
- The operator must verify HTTPS, the effective edge headers, request-body logging exclusions, webhook retention/access controls, secret storage, delivery-domain egress controls, and fallback behavior on the deployed endpoint.
- No live endpoint, WAF, webhook provider, or real contact record was used in this verification.
