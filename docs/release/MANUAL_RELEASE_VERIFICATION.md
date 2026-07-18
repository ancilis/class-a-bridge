# Manual release verification

Release candidate: Class A Bridge 0.9.0 Public Beta

Status: **Pending human execution**

This script is prepared for a release operator. No item is passed until a person
performs it on the named browser and records the date, build checksum, operator,
result, and evidence location. Automated Playwright results are recorded
separately and do not substitute for this matrix.

## Test record

For each run, record:

- Release commit and combined-release SHA-256
- Operating system and hardware
- Browser name and exact version
- Installed/PWA or ordinary browser-tab mode
- Operator and date
- Passed, failed, or passed with limitation
- Screenshot, screen recording, console capture, or written observation location
- Local test-data deletion confirmation

## Required browser matrix

| Environment                               | Ordinary browser | Installed PWA                                    | Offline restart | Status  |
| ----------------------------------------- | ---------------- | ------------------------------------------------ | --------------- | ------- |
| Chromium desktop                          | Required         | Required                                         | Required        | Pending |
| Firefox desktop                           | Required         | Not applicable where installation is unsupported | Required        | Pending |
| Safari/WebKit on supported Apple hardware | Required         | Required where supported                         | Required        | Pending |

## Workflow

1. Load the production build over HTTPS and confirm the expected release version,
   catalog version, schema manifest, Content Security Policy, and secure headers.
2. Start without an account and complete the eight-question preliminary interview.
   Confirm that the result explains its answers, rules, uncertainty, and next actions.
3. Open the fictional Acme Metrics workspace and confirm that every screen and
   download says “Fictional example — not for submission.”
4. Create a new project manually. Refresh, close the tab, restart the browser, and
   confirm IndexedDB restoration plus accurate last-saved feedback.
5. Import a representative auditor-issued SOC 2 Type II report locally. Do not
   commit it, upload it, or place its text in logs. Confirm extraction suggestions,
   page/snippet provenance, editing, ignoring, and manual fallback.
6. Repeat with malformed, password-protected, image-only, and oversized fixtures.
   Confirm safe errors and continued manual/CSV access.
7. Import SOC 2 controls from CSV, review deterministic reuse suggestions, reject
   one, confirm one partial mapping with reviewer/date, and record a scope conflict,
   period conflict, auditor exception, and carve-out.
8. Confirm that no suggestion or attachment changes a requirement status, provider
   approval, or generated representation automatically.
9. Complete one Key Security Indicator in Guided mode, switch to Record mode, and
   confirm no data loss.
10. Add evidence metadata and a local file. Confirm candidate labeling, hash,
    freshness, sensitivity, and explicit relationship handling.
11. Generate the SOC 2 Reuse and Gap Report, executive report, official JSON,
    validation report, package ZIP, and advisor handoff. Inspect print-to-PDF output.
12. Confirm invalid JSON is not labeled valid and every validation issue links to
    the corresponding editable field.
13. Generate standard and password-protected backups. Delete local data, restore
    each backup, and compare the restored project with the pre-delete record.
14. Install the PWA, restart offline, reopen the project, and repeat a save/export.
15. Observe DevTools network traffic throughout PDF import, mapping, evidence,
    reports, package, backup, deletion, and restore. Confirm no project/document
    canary appears in requests, WebSockets, beacons, or analytics.
16. Open the Ancilis review call to action and submit contact details only. Confirm
    no project, control excerpt, evidence, requirement, or package content is sent.
17. Test keyboard-only navigation, visible focus, dialogs, status announcements,
    errors, tables, 200% zoom, reduced motion, tablet layout, and print output.
18. Inspect browser console output for uncaught errors, React warnings, mixed
    content, failed assets, source-map exposure, and service-worker failures.
19. Delete the representative report, project, attachments, downloads, and browser
    storage created for the test. Record only pass/fail observations.

## 1.0.0 gate

Version 1.0.0 remains blocked until this matrix is completed on real supported
hardware, release-blocking findings are resolved, and the evidence is reviewed.
