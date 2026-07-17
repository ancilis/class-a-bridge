# Privacy model

Last updated: 2026-07-17

This document describes the default behavior of the open-source Class A Bridge software. A third-party deployment may operate its public website or optional contact endpoint under additional notices; operators must disclose any change before collecting data.

## Private bridge workspace

The bridge application processes project information in the user's browser. It does not require an account or backend and does not intentionally send SOC 2 reports, extracted text, answers, scope records, controls, evidence metadata, attachments, requirement work, or generated package content to Ancilis or another service.

The default application includes:

- no assessment analytics;
- no remote artificial-intelligence service;
- no remote document parser or optical character recognition;
- no remote error reporting;
- no third-party scripts, fonts, or trackers; and
- no automatic assessor, advisor, or Ancilis sharing.

Projects and selected attachments are stored in browser storage on the device. Anyone with access to the same browser profile or an exported backup may be able to access that information. Users should use an access-controlled device, export backups deliberately, choose password-protected export for sensitive transfer, and delete local data when the device is shared or retired.

Clearing browser data, private-browsing expiration, storage eviction, or device loss can erase local work. A standard or password-protected `.classabridge` backup is the recovery mechanism. Passwords are not stored and cannot be recovered.

## Exports and sharing

Export is initiated by the user. Standard project export includes the project record and only attachments the user selects. Redacted advisor handoff excludes original reports, attachments, report excerpts, and sensitive notes by default. Users must review the export manifest before sharing.

Generated reports may contain user-entered project information. Download locations, browser history, print queues, email systems, shared drives, and recipient systems are outside the application's control.

## Marketing website

The public website can be served without analytics. If an operator enables privacy-conscious analytics, it must remain outside the bridge origin and must not receive document names, answers, requirement progress, evidence metadata, project identifiers, or fingerprinting data. This repository enables no marketing analytics by default.

Ordinary web hosting may process IP address, user agent, requested URL, time, and security logs. The deployment operator is responsible for a retention schedule, access controls, and an accurate site-specific notice.

## Optional contact request

The contact form sends only fields the user enters in that form: name, email, company, role, a high-level message, and—only when deliberately included—an approved summary. It cannot read the bridge project. Users should not paste report text, evidence, credentials, security incidents, personal data unrelated to contact, or confidential attachments into the form.

The optional endpoint is separate from the bridge and rejects unknown/project fields. The operator decides the contact recipient, lawful basis, retention period, and deletion process and must disclose those details in its deployment notice. Without an endpoint, the site uses an email fallback and retains no form data.

## Data deletion

The bridge's project settings can delete the current project or all Class A Bridge browser data. Deletion does not recall previously exported, printed, emailed, or shared copies. Website/contact deletion requests must go to the operator that received the contact record.

## Changes

Changes that introduce assessment telemetry, remote processing, accounts, synchronization, or third-party scripts require an explicit architecture and privacy review, updated documentation, visible user choice, and release notes. They must not be enabled silently.
