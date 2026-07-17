# Architecture decisions

This log records material 1.0 decisions. A future change adds a dated entry rather than rewriting the reason a prior release behaved as it did.

## ADR-001: Browser-only core

**Decision:** All assessment, persistence, validation, document generation, hashing, encryption, and export occur in the browser. No login or backend is required.

**Reason:** SOC 2 reports, evidence, exceptions, scope, and incident materials are sensitive. A server would add custody, account, retention, breach, availability, and trust obligations that are unnecessary for the core outcome.

**Consequence:** Collaboration is file-based; browser storage can be evicted; users need explicit backups; very large projects are constrained by device/browser resources.

## ADR-002: Separate static website and PWA

**Decision:** Public content and the private workspace build/deploy independently.

**Reason:** The website benefits from static search rendering, while the bridge needs a narrow script/network boundary and isolated browser storage.

**Consequence:** Operators manage two static outputs and must keep calls to action/canonical URLs aligned.

## ADR-003: Official bytes plus separate guidance

**Decision:** Pin unmodified official sources and store Ancilis guidance as separate authored records.

**Reason:** Provenance must be inspectable, changes reviewable, and official text must not be silently rewritten to match a product interpretation.

**Consequence:** Updates require more human review and may surface unresolved official inconsistencies.

## ADR-004: Precompiled JSON validators

**Decision:** Generate standalone AJV validators at maintainer build time.

**Reason:** The app can validate offline without runtime schema fetches or dynamic code generation, preserving a strict Content Security Policy.

**Consequence:** Every schema update requires validator regeneration and checksum/test review.

## ADR-005: Explicit attachment inclusion

**Decision:** Standard/package/advisor exports exclude source attachments unless the user selects them; the advisor projection redacts by construction.

**Reason:** Accidental disclosure is a higher risk than the convenience of silently complete archives.

**Consequence:** Export UX must show missing attachments clearly and let a user make deliberate inclusion choices.

## ADR-006: Optional contact-only service

**Decision:** Advisory conversion uses a distinct optional handler with no project dependency.

**Reason:** A user must be able to contact Ancilis without granting custody of assessment data, and the free application must work without services.

**Consequence:** Secure project sharing, if later desired, is a separate explicit process outside the 1.0 application.
