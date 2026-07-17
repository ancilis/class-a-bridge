# Security policy

## Supported versions

Security updates are provided for the latest released minor version. The `main` branch may contain unreleased changes and is not a substitute for a tagged release. Operators should verify the release tag, lockfile, build provenance, and deployment headers.

| Version               | Security support                                          |
| --------------------- | --------------------------------------------------------- |
| 1.x latest            | Supported                                                 |
| Earlier 1.x releases  | Upgrade required unless a release advisory says otherwise |
| Development snapshots | Best effort; not a supported release                      |

## Report a vulnerability privately

Do not open a public issue, discussion, pull request, or contact-form message for an undisclosed vulnerability. Use the repository host's private security-advisory feature when available. If that is unavailable, email `hello@ancilis.com` with the subject “Class A Bridge security report” and request a secure channel before sending exploit details.

An initial report should contain only:

- affected version or commit;
- affected component and deployment context;
- impact in plain language;
- whether exploitation is known; and
- a safe way to contact you.

Do not send a real SOC 2 report, real evidence, credentials, tokens, personal data, or another organization's project bundle. Use a minimal fictional reproducer after a secure channel is agreed.

Maintainers aim to acknowledge a complete report within five business days, then coordinate validation, remediation, disclosure timing, and credit. This is a target, not a service-level agreement. Please allow a reasonable remediation period before public disclosure.

## In-scope examples

- project data transmitted without an explicit user export/share action;
- cross-site scripting or document-content injection;
- unsafe PDF parsing or active content execution;
- project-bundle traversal, duplicate-path, decompression, schema, or migration bypass;
- attachment, evidence, or browser-storage disclosure across projects/origins;
- cryptographic misuse that exposes password-protected exports;
- generated HTML, CSV, DOCX, PDF, or filename injection;
- Content Security Policy or service-worker behavior that enables remote code;
- dependency or build-chain compromise;
- contact endpoint validation, origin, rate-limit, log-redaction, or body-limit bypass.

The absence of FedRAMP acceptance, a disagreement with clearly labeled Ancilis guidance, social engineering, denial of service requiring impractical local resources, and issues in an operator's modified deployment are normally not vulnerabilities in this repository. Report them through the appropriate public issue or operator channel without sensitive data.

## Safe research

Test only systems and data you own or have explicit permission to test. Do not access another person's browser profile, deployment, contact records, or exports; degrade public service; persist access; or exfiltrate data. Stop when sensitive information could be exposed and report privately.

## Operator responsibilities

Use HTTPS, immutable releases, security headers, protected deployment credentials, a supported browser, least-privilege hosting, dependency/secret scanning, contact-data retention controls, and tested backup/deletion procedures. The bridge should have no third-party scripts or assessment analytics. See [docs/security/THREAT_MODEL.md](docs/security/THREAT_MODEL.md) and [docs/deployment/README.md](docs/deployment/README.md).
