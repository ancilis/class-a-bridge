# Security control implementation guide

This guide maps the principal implementation controls to their code/configuration owners and verification evidence. It is an engineering aid, not a FedRAMP control assessment.

| Control                          | Owner in repository                                      | Verification                                                           |
| -------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------- |
| No project network transmission  | Bridge architecture/CSP/browser tests                    | Canary request interception across the complete flow                   |
| Strict project trust boundary    | `packages/project` Zod schemas and migrations            | Unknown-field, invalid-version, migration, and restore tests           |
| Safe archive handling            | `packages/project/src/bundle.ts`                         | Traversal, duplicate, undeclared, ratio, size, entry-count, hash tests |
| Export confidentiality/integrity | `packages/project/src/security.ts` and bundle manifest   | Wrong password/tamper/round-trip/checksum tests                        |
| Safe PDF handling                | Bridge local PDF adapter                                 | Type/size/encrypted/image/malformed fixtures; network interception     |
| Safe generated content           | `packages/documents`, `packages/project/src/security.ts` | HTML injection, CSV formula, filename, watermark tests                 |
| Official content integrity       | `packages/rules`, `packages/schemas`                     | Catalog/schema hash/required-rule/validator tests                      |
| No dynamic execution             | Precompiled validators + CSP                             | Source/build scan for `eval`/`Function`; response-header check         |
| Browser storage transparency     | Project settings/storage adapter                         | Adapter contract, failure/fallback, size/save/delete-all tests         |
| Explicit disclosure boundary     | Export/advisor projection                                | Canary secrets absent from default/redacted outputs                    |
| Contact-only API                 | `apps/contact-api`                                       | Unknown project fields, origin, limit, honeypot, rate/log tests        |
| Dependency integrity             | lockfile, Dependabot, CI workflows                       | Frozen install, dependency review, audit, CodeQL                       |
| Secure hosting                   | `deploy/*`, website host configs                         | `curl`/browser response-header checks over HTTPS                       |
| Accessible security decisions    | UI/content system                                        | Keyboard, axe, semantic error, focus, zoom, contrast review            |

## Content Security Policy

The bridge deployment baseline is:

```text
default-src 'self';
base-uri 'none';
connect-src 'self';
font-src 'self';
form-action 'none';
frame-ancestors 'none';
img-src 'self' data: blob:;
manifest-src 'self';
media-src 'none';
object-src 'none';
script-src 'self';
style-src 'self';
worker-src 'self' blob:;
upgrade-insecure-requests
```

`connect-src 'self'` supports same-origin progressive web application update behavior; it is not permission to add an assessment API. End-to-end network tests remain authoritative. A deployment that adds a remote origin to `script-src`, `worker-src`, `connect-src`, or `font-src` requires security/privacy review.

The website uses its separately documented static policy. It must not weaken the bridge policy when origins are shared.

## Browser cryptography

- Algorithm: AES-256-GCM.
- Key derivation: PBKDF2-HMAC-SHA-256, 310,000 iterations by default.
- Salt: 16 random bytes per export.
- Initialization vector: 12 random bytes per export.
- Additional authenticated data: versioned envelope label.
- Password: minimum 12 characters; never stored or recoverable.
- Envelope: strict magic/version/algorithm/KDF/iteration fields with total-size limits.

Changes to algorithm, work factor, encoding, or envelope compatibility require test vectors and security review. Do not imply that password protection compensates for a weak/reused password or compromised endpoint.

## Logging

The bridge does not send logs. Local diagnostics use product version, browser capabilities, error codes, and sanitized code locations; project values and filenames are absent by default.

The optional contact handler's logger accepts a closed event type: event name, request ID, safe reason code, and status. It never receives the parsed contact record or delivery exception. Platform/proxy logs must avoid request bodies and authorization headers. Access logs should use a documented short retention period.
