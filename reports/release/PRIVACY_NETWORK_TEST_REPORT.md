# Privacy network-test report

Evidence snapshot date: 2026-07-18  
Target: Class A Bridge 0.9.0 Public Beta  
Final release commit/checksum: **PENDING**

## Decision

**Automated production privacy canary passed in Chromium, Firefox, and WebKit.**
During the covered local assessment flow, the test detected no unexpected origin
and no project/document canary disclosure. This verifies the automated production
path; manual real-hardware storage inspection and deployed contact operation
remain pending.

## Observed canary flow

`e2e/privacy-network.spec.ts` observes network activity while the application:

1. opens the production build without an account;
2. imports a fictional local SOC 2 PDF fixture;
3. confirms extracted information;
4. records SOC 2 controls and mappings;
5. adds evidence metadata;
6. generates reports and a package;
7. exports the project; and
8. checks request URLs, headers, bodies, WebSockets, and frames for canary data.

The fixture is `e2e/fixtures/fictional-soc2-privacy-canary.pdf`. It is fictional
and contains no customer data.

## Browser results

| Browser  | Test executions | Unexpected origins |  Canary disclosure | Result |
| -------- | --------------: | -----------------: | -----------------: | ------ |
| Chromium |             1/1 | 0 asserted by test | 0 asserted by test | Passed |
| Firefox  |             1/1 | 0 asserted by test | 0 asserted by test | Passed |
| WebKit   |             1/1 | 0 asserted by test | 0 asserted by test | Passed |

Raw request totals were not retained as release evidence; the durable result is
the pass/fail assertion against unexpected destinations and the canary set. The
privacy test is also included in the 21/21 production Playwright matrix.

Commands:

```sh
pnpm test:e2e
pnpm test:cross-browser
```

## Contact isolation

The isolated contact package passed 60/60 workspace tests, including input and
production-configuration behavior. The assessment call to action and ordinary
workspace do not submit project content. Public endpoint operation, deployed
rate-limiting behavior, and production log inspection remain pending because no
production deployment is recorded.

## Manual privacy verification

The following remain pending under
`docs/release/MANUAL_RELEASE_VERIFICATION.md`:

- IndexedDB, Cache Storage, cookie, localStorage, and sessionStorage inspection;
- persistence after browser restart and installed-PWA offline restart;
- redacted advisor-handoff content inspection;
- delete-all behavior on representative hardware;
- real-hardware network observation; and
- deployed contact-endpoint isolation.

## Release interpretation

- Automated three-browser no-egress gate: **Passed**.
- Covered claim: project and document canaries were not transmitted during the
  automated production assessment flow.
- Manual real-hardware privacy review: **Pending; documented beta limitation and
  1.0.0 blocker**.
- Public contact deployment verification: **Pending**.
- Final release commit and build checksum: **Pending**.
