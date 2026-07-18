# Release integrity scan

Status: **PASSED**

Scanned files: 699
Scanned archives: 4
Active findings: 0
Reviewed allowlist matches: 2

The scan covers repository source and generated distribution files while excluding dependency, cache, and intermediate-framework directories. Finding reports contain repository-relative locations and cryptographic fingerprints, never matched secret content.

No release-blocking integrity finding was detected.

## Reviewed exceptions encountered

| Rule | Repository-relative location | Finding SHA-256 |
| --- | --- | --- |
| workstation:linux-profile | apps/bridge/dist/assets/pdf.worker.min-Dtn11Elq.mjs | 10e234638c84fed736a876dd78ee5c3e75e0b45003726fc5f8405ccb7294011d |
| workstation:linux-profile | dist/class-a-bridge/app/assets/pdf.worker.min-Dtn11Elq.mjs | bc973a2aab7084e13b4455de197fa2a8ba28eff475ffd094abb008a4e69f38a6 |

