# UX Audit

## Strengths to preserve

- Three immediate first-run paths and no account wall.
- Eight-question explainable eligibility result.
- Persistent private-workspace indicator.
- Human-confirmed extraction and mappings.
- Actionable status vocabulary, explicit approval, and local data controls.

## Release gaps

- SOC 2 controls and mappings are embedded in the broader materials page; users do not receive an immediate reuse summary.
- Manual controls capture only identifier, title, criteria, pages, test, result, exception IDs, and excerpt.
- No CSV template/import or spreadsheet-paste workflow exists.
- Manual mappings start as confirmed even though the reason says scope/period still require confirmation.
- Rule identifiers dominate the mapping selector and suggestions are absent.
- Mapping labels include `likely covered`, which can imply more certainty than the product can support.
- The 707-line SOC 2 materials feature and 5,649-line shell increase test and maintenance cost.

## Targeted correction

Add a plain-language `SOC 2 reuse` destination; inventory import; explainable candidates; individual review; scope/period/exception/carve-out callouts; and a report. Preserve the dense record workflow for experienced users. Empty, error, import-recovery, keyboard, mobile/tablet, print, and autosave states receive explicit tests.
