# Security Verification Plan

## Automated gates

- Forced clean install/build/test under Node 24 and pnpm 10.33.0.
- Rules/schema checksums and generated-validator integrity.
- PDF type/size/signature/malformed/image/protected behavior.
- ZIP traversal, duplicate, undeclared, count, size, ratio, hash, and identity attacks.
- HTML, CSV formula, filename, JSON, and report injection tests.
- AES-256-GCM/PBKDF2 round trip, malformed envelope, tamper, work-factor, and password tests.
- Contact origin/schema/body/honeypot/rate/log/delivery tests.
- Production-build network canaries in Chromium, Firefox, and WebKit.
- CSP/header/static URL/source-map/local-path/residue scans.
- `pnpm audit --prod`, secret scan, static analysis, license inventory, and CycloneDX SBOM.

## Manual gates

Production host response headers, Safari/WebKit hardware, IndexedDB across restart, install/offline restart, print output, representative auditor PDF, and contact operations require recorded human observation. Until completed, they remain unresolved and the release remains public beta.

## Evidence rule

Each checklist item records command or procedure, date, exact commit, evidence path, reviewer, and notes. Source inspection alone is not a pass.
