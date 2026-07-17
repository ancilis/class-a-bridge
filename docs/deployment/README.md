# Deployment

Class A Bridge has a canonical combined static release, two source app outputs, and one optional server-side package:

- `dist/class-a-bridge` — production assembly with the website at `/`, bridge at `/app/`, merged path-specific headers, release manifest, and source download;
- `apps/website/out` — public marketing, guidance, legal, and documentation pages;
- `apps/bridge/dist` — private local-first progressive web application; and
- `apps/contact-api/dist` — optional contact-only Web handler, deployed separately and used only by the website.

No endpoint is required for the bridge. A deployment without the contact handler remains a complete preparation product and uses the website's email fallback.

## Clean production build

```sh
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
pnpm verify
```

Deploy only generated output from the reviewed commit. The source archive is made from Git `HEAD`, so commit the reviewed release state before the final assembly and verify its archive contents. Do not deploy the development server, repository root, `.env` files, source maps containing local paths, tests, or sample build caches. Preserve the release tag, commit, lockfile hash, release manifest, and build log with deployment evidence.

## Recommended topology

For the canonical same-origin deployment, publish `dist/class-a-bridge`; the release assembler has already aligned the `/app/` asset/service-worker path and added the stricter `/app/*` policy. The website's wildcard Content Security Policy deliberately permits the app's same-origin and `blob:` image/worker sources because some static hosts apply both matching header blocks; the app-specific policy still denies forms, frames, remote scripts, and remote connections. Release assembly fails if these overlapping policies become incompatible. Leave `NEXT_PUBLIC_BRIDGE_APP_URL` and `VITE_WEBSITE_URL` unset: website assessment links default to `/app/`, and the bridge's contact/privacy links default to the current same-origin parent. The website contains no project integration or third-party runtime script. Verify both root and `/app/` paths.

For stronger browser-origin isolation, deploy `apps/bridge/dist` at the root of a dedicated bridge origin using the host-specific configurations below. Set both public URLs before the corresponding builds:

```sh
# Website build: exact HTTPS root where the bridge is published.
NEXT_PUBLIC_BRIDGE_APP_URL=https://bridge.example.com/

# Bridge build: exact HTTPS root containing /contact/ and /security-and-privacy/.
VITE_WEBSITE_URL=https://www.example.com/
```

`NEXT_PUBLIC_BRIDGE_APP_URL` belongs in the website build environment; `VITE_WEBSITE_URL` belongs in the bridge build environment. They are compiled into static links, contain no project data, and require a rebuild when changed. Both accept an origin root or an HTTPS URL with a path and normalize a missing trailing slash. Do not include credentials, a query string, or a fragment. This topology gives IndexedDB and the service worker their own origin/scope while keeping deliberate contact and privacy navigation on the public website. A custom path-mounted bridge deployment also requires matching Vite base, manifest `start_url`/`scope`, service-worker scope, SPA fallback, and tests.

The bridge origin must not add analytics, tag managers, chat widgets, remote fonts, remote error reporters, authentication proxies that capture bodies, or injected hosting scripts.

## Hosting choices

| Host                 | Build/publish settings                                                                                                                   | Security-header note                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Netlify              | Use `deploy/netlify.bridge.toml` as the project configuration                                                                            | Applies CSP, HSTS, cache and PWA headers                                                                                 |
| Vercel               | Use `deploy/vercel.bridge.json` as `vercel.json` for the bridge project                                                                  | Keep website and bridge as separate projects/origins                                                                     |
| Cloudflare Pages     | Build with `pnpm --filter @class-a-bridge/bridge build`, output `apps/bridge/dist`; include `deploy/cloudflare-pages/_headers` in output | Verify Pages has not modified CSP or MIME types                                                                          |
| Nginx/static VM      | Copy `apps/bridge/dist` to `/srv/class-a-bridge/bridge`; use `deploy/nginx/class-a-bridge.conf` for the documented bridge subdomain      | Provision the documented certificate/DNS before enabling the checked-in one-year HSTS policy                             |
| Object storage + CDN | Upload hashed assets immutably; `index.html` and `sw.js` no-cache; map SPA fallback to `/index.html`                                     | Configure every baseline response header at the CDN                                                                      |
| GitHub Pages         | Static files work, but Pages does not provide repository-controlled security headers                                                     | Not recommended for production projects containing sensitive data; place behind a header-capable CDN or use another host |

The website has its own checked-in Netlify/Vercel/static headers under `apps/website`. Its policy allows the static framework behavior needed by the public site and must not be copied over the stricter bridge policy.

## Required bridge headers

Use the complete policy in `deploy/*` and [SECURITY_CONTROLS.md](../security/SECURITY_CONTROLS.md). At minimum verify:

- Content Security Policy with same-origin scripts/workers and no remote script origin;
- `Strict-Transport-Security: max-age=31536000` after HTTPS readiness is confirmed;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`;
- `Referrer-Policy: no-referrer`;
- restrictive `Permissions-Policy`;
- opener/resource isolation;
- correct JavaScript, manifest, icon, and service-worker MIME types;
- no-cache for `index.html` and `sw.js`; and
- one-year immutable cache only for content-hashed assets.

The checked-in website, bridge, and dedicated-host examples deliberately omit HSTS `includeSubDomains` and `preload`. Add either directive only after every affected subdomain is permanently HTTPS and the domain owner has completed a separate preload-readiness review. Do not send HSTS from a plain-HTTP development or preview origin.

## Single-page and PWA behavior

Unknown application routes must serve `index.html` with status 200, while missing asset paths must remain 404. `sw.js` must be served from the bridge root with `Service-Worker-Allowed: /`, JavaScript MIME type, and no-cache. Do not rewrite missing `.js`, `.css`, schema, icon, or manifest requests to HTML.

Verify install, update, offline reload, deep-link reload, and recovery after unregistering the service worker. Project records live in IndexedDB and must survive an ordinary static deployment update. Test migrations before deploying an app version that changes the project schema.

## Contact service

Follow [CONTACT_API.md](CONTACT_API.md). The endpoint lives outside the bridge origin and must never be placed behind middleware that records JSON bodies. Configure an exact website-origin allowlist and an operator-owned delivery sink. Multi-instance deployments require a shared atomic rate limiter or provider equivalent.

## Production verification

Run the [security testing procedure](../security/SECURITY_TESTING.md), including canary request interception and production response-header checks. Test a fictional export/delete/import round trip. Confirm the Acme Metrics watermark, official catalog/schema version manifest, and product disclaimer are present.

## Rollback

Keep the prior static release available. A rollback changes application assets only; it must not delete browser stores. Do not roll back across an irreversible project migration without a compatibility test. In a security incident, remove the vulnerable static assets, publish a clear advisory, and tell users whether exported projects require action. Never request customer project files through the public contact form for diagnosis.
