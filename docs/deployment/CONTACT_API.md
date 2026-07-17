# Optional contact API deployment

`apps/contact-api` is a host-neutral Web `Request`/`Response` handler. It is optional and deliberately isolated from the bridge. The core application must never import this package or call the endpoint.

## Accepted record

The handler accepts only:

- `name` (required, 120 characters);
- `email` (required, 254 characters);
- `company` (optional, 160 characters);
- `role` (optional, 120 characters);
- `message` (required, 2,000 characters);
- `approvedSummary` (optional, 1,000 characters, typed/approved in the contact form); and
- `website` (optional honeypot; a non-empty value is discarded).

The complete JSON body limit is 16 KiB, including chunked bodies. Unknown keys are rejected, including project, answers, evidence, attachments, report text, requirement work, scope, and package fields. Multipart/file upload is unsupported.

The default handler path is exactly `/api/contact`; other paths and query-bearing requests return 404 without reading a body. The static website accepts a relative build-time endpoint only. Set `NEXT_PUBLIC_CONTACT_ENDPOINT=/api/contact` when building the website, and route that path to the separately deployed function/Worker at the hosting edge. The bridge under `/app/` never calls it, and its stricter Content Security Policy blocks connections.

## Host adapter

After `pnpm --filter @class-a-bridge/contact-api build`, import the compiled package in the host's function adapter:

```ts
import {
  MemoryRateLimitStore,
  createContactHandler,
  createWebhookDelivery,
} from "@class-a-bridge/contact-api";

const rateLimitStore = new MemoryRateLimitStore();
const handler = createContactHandler({
  allowedOrigins: [process.env.CONTACT_WEBSITE_ORIGIN],
  deliver: createWebhookDelivery({
    url: process.env.CONTACT_WEBHOOK_URL,
    bearerToken: process.env.CONTACT_WEBHOOK_TOKEN,
  }),
  getClientKey: (request) => request.headers.get("x-platform-verified-client-key") ?? "anonymous",
  logger: (event) => console.info(JSON.stringify(event)),
  rateLimit: { limit: 5, windowMs: 60 * 60 * 1000, store: rateLimitStore },
});

export default { fetch: handler };
```

The snippet shows the interface; adapt environment access and exports to the chosen runtime. Validate required environment values at startup. `CONTACT_WEBSITE_ORIGIN` must be one exact HTTPS origin, not `*`, a suffix, or a user-supplied header value. `CONTACT_WEBHOOK_URL` must be an operator-controlled HTTPS endpoint. Store the token in the platform's secret manager, rotate it, and never expose it to website JavaScript.

`getClientKey` must use a client address/key authenticated by the hosting platform or adapter. Do not trust an arbitrary public `X-Forwarded-For` header. Hashing the address with a rotating server secret before passing the key reduces retention of raw network identifiers.

## Rate limiting

`MemoryRateLimitStore` is bounded and works for one long-lived process. It resets on restart and does not coordinate across replicas. For serverless, edge, or horizontally scaled use, implement the `RateLimitStore` interface with an atomic shared store or configure the provider's WAF/rate limiting plus the application store. Preserve a fixed window, a small per-client limit, and a global abuse ceiling.

Do not weaken validation or accept project content as a workaround for a delivery provider.

## Delivery and retention

`createWebhookDelivery` uses HTTPS, refuses URL credentials and redirects, applies a timeout, and treats non-success responses as a generic failure. Restrict the receiving system to the same contact-only fields. It must render values as text, not HTML, and must not include them in alert titles, URLs, or logs.

Before enabling the endpoint, publish an operator-specific notice that identifies the recipient/controller, purpose, lawful basis where applicable, retention period, access restrictions, deletion/contact method, and cross-border/subprocessor behavior. Use the shortest practical retention and delete abandoned/spam requests. Do not use contact records for unrelated marketing without separate permission.

## Safe logs

The handler logger receives only event name, random request ID, HTTP status, and a closed safe reason code. It never receives parsed contact values or delivery exception text. Configure reverse proxy, function, WAF, APM, and webhook logs to exclude request/response bodies, query strings, authorization headers, and raw contact fields. Do not enable generic request-body tracing.

## Test before enabling

Run `pnpm --filter @class-a-bridge/contact-api test`, then verify:

- an exact allowed-origin request is delivered once;
- another/missing Origin is rejected;
- unknown `project` and `evidence` keys are rejected;
- a streaming body over 16 KiB is rejected;
- a filled honeypot returns the normal accepted response but is not delivered;
- throttling works across the deployed instance model;
- delivery redirects/timeouts/failures expose no provider detail;
- access/application/delivery logs contain none of the test email/message canaries; and
- the website provides its email fallback when the endpoint is absent or unavailable.

Never test with a real report or project bundle.

## Included Cloudflare Worker adapter

`apps/contact-api/src/worker.ts` is an actual Worker entry point compiled to `dist/worker.js`; `apps/contact-api/wrangler.jsonc` pins the worker name, compatibility date, public website origin, and disables optional observability. Configure the Worker route for `https://classabridge.ancilis.com/api/contact`. Configure `CONTACT_WEBHOOK_URL` and optional `CONTACT_WEBHOOK_TOKEN` as Worker secrets through the organization's approved Cloudflare deployment process. Do not commit them or place them in `vars`.

The adapter derives its rate-limit key from Cloudflare's `CF-Connecting-IP` value, applies five requests per hour per key in each isolate, and emits only typed safe events. Add Cloudflare WAF/rate limiting or a shared `RateLimitStore` adapter for enforcement across isolates. Verify the deployed Worker with the same negative tests and log canaries before setting the website endpoint.
