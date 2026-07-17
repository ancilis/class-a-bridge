# Security testing procedure

Run this procedure against the exact release candidate and production-like host configuration. Record command output, browser versions, deployment URL, commit, lockfile hash, and reviewer in the release evidence. Do not use real assessment data.

## Automated gates

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:a11y
pnpm test:e2e
pnpm audit --prod --audit-level high
```

CI also runs CodeQL and dependency review. Repository-host secret scanning and push protection should be enabled. Review every audit exception; do not suppress a finding only because it is development-time.

## Built-artifact inspection

1. Search `apps/bridge/dist` for `http://`, `https://`, WebSocket URLs, analytics identifiers, remote fonts, tag managers, source maps, and secrets. Explain every match.
2. Confirm no production source map contains project fixtures, local file paths, or secrets.
3. Confirm the service worker precache contains static application assets only.
4. Confirm official rule/schema manifests and checksums match vendored bytes.
5. Verify the package lockfile and CI action commit pins are unchanged from reviewed content.

## No-project-data network test

Use unique non-secret canaries that cannot occur in static assets:

- PDF filename and PDF page text;
- project/organization name;
- one eligibility answer explanation;
- one scope resource;
- one evidence title/hash label;
- one requirement narrative;
- one project identifier.

Start request observation before opening the bridge. Cover first run, local PDF parsing, eight answers/result, editing, scope, mapping, evidence attachment, narrative, package/validation, standard export, local delete, import/restore, redacted export, offline reload, and service-worker update.

Fail the release if a canary appears in any request URL, query, fragment sent as referrer, header, body, beacon, WebSocket, or unexpected origin. Same-origin static GET requests may be allowlisted by fixed asset path only; never allowlist based on payload content. Repeat in Chromium, Firefox, and WebKit.

## Malicious-input suite

- PDF: wrong signature, oversized, encrypted, malformed cross-reference, image-only, embedded link/form/script, Unicode controls, and long page text.
- Project: unknown fields, invalid enum/date/hash, unsupported future version, duplicate identifiers, malicious HTML/CSV/filename text, and migration failure.
- ZIP: absolute/traversal/backslash/NUL/dot paths, duplicate paths, undeclared entries, altered hash, manifest identity mismatch, excessive entries, 25 MiB entry breach, expanded-total breach, and high compression ratio.
- Encryption: wrong password, modified salt/IV/ciphertext/algorithm/version/iterations, malformed base64, oversized envelope, and truncated ciphertext.
- Contact: unapproved/missing Origin, invalid preflight/method/media type/JSON/email/controls, unknown project/evidence fields, absent/dishonest content length, streaming body overflow, filled honeypot, throttling, delivery timeout/failure, redirect, and log canaries.

Verify failure is understandable, source state is unchanged, no sensitive value appears in logs/errors, and the recovery action is usable by keyboard.

## Security headers

For both the document and a representative static asset, inspect production responses:

```sh
curl --fail --silent --show-error --dump-header - --output /dev/null "$BRIDGE_DEPLOYMENT_URL/"
curl --fail --silent --show-error --dump-header - --output /dev/null "$BRIDGE_DEPLOYMENT_URL/manifest.webmanifest"
```

Set `BRIDGE_DEPLOYMENT_URL` to the reviewed HTTPS origin. Confirm Content Security Policy, HSTS, no sniff, frame denial, referrer, permissions, opener/resource policies, correct MIME types, cache rules, and no permissive cross-origin header. Use browser developer tools to confirm zero CSP errors in the full flow.

## Manual browser/privacy review

1. Use a clean browser profile with extensions disabled.
2. Verify all project work after initial load with network disabled.
3. Inspect IndexedDB, localStorage, Cache Storage, service-worker registrations, cookies, and sessionStorage. Project content belongs only in the documented project store; it must not be in Cache Storage/cookies.
4. Export, inspect, delete, and restore a fictional project. Confirm default attachments absent and redacted canaries absent.
5. Delete all local data and verify owned storage/attachments disappear after reload.
6. Confirm the public website cannot read the bridge store and the contact call-to-action sends nothing until the form is submitted.

## Release decision

Any unplanned project request, script origin, data store, archive entry, High severity dependency, secret, unsafe generated output, or missing critical host header blocks release. Document accepted Medium residual risks and the responsible operator/user guidance in the checklist.
