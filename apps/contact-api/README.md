# Optional contact API

This package is the only server-side component in Class A Bridge. It is optional, deploys separately from the private workspace, and accepts contact fields only. The bridge application never imports it.

`createContactHandler` exposes a Web `Request`/`Response` handler for an edge function, serverless function, or Node adapter. `createContactWorker` and `wrangler.jsonc` provide a compiled Cloudflare Worker adapter. The caller must provide:

- an exact allowlist of website origins;
- a delivery function, such as `createWebhookDelivery` with an operator-controlled HTTPS endpoint;
- a client-key function based on the hosting platform's trusted client-address signal; and
- a rate-limit store. `MemoryRateLimitStore` is bounded and suitable for one long-lived process; distributed or multi-instance deployments must supply a shared store.

The handler is limited to `/api/contact` and rejects other/query-bearing paths, unknown keys, assessment/project fields, unsupported media types, unapproved origins, invalid contact values, and bodies over 16 KiB. It applies an indistinguishable honeypot response, no-store/security headers, safe event-only logs, and generic delivery failures.

Its HSTS policy is host-scoped for one year. The package intentionally does not claim domain-wide `includeSubDomains` or preload readiness; those are deployment-owner decisions.

See [`docs/deployment/CONTACT_API.md`](../../docs/deployment/CONTACT_API.md) for an adapter example, environment boundaries, retention requirements, and verification steps.
