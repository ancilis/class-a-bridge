# Static hosting notes

## Cloudflare Pages

Set the root directory to the repository root, provision pnpm 10.33.0 in the build image, use `pnpm --filter @class-a-bridge/bridge build` as the build command, and set the output directory to `apps/bridge/dist`. Arrange for `deploy/cloudflare-pages/_headers` to be copied into the published root as `_headers` in the deployment pipeline. Configure a custom HTTPS domain and disable analytics/injected scripts on the bridge project.

## Netlify

Create a dedicated site from the repository and point its configuration file at `deploy/netlify.bridge.toml`, or copy those settings into the site's root `netlify.toml`. Do not reuse the website site's environment or plugins. Verify the SPA rewrite does not turn missing assets into HTML.

## Vercel

Create a dedicated project and use `deploy/vercel.bridge.json` as its `vercel.json`. Framework preset should be “Other,” with the repository root available to pnpm workspaces. Do not enable analytics, speed-insights injection, or third-party monitoring for the bridge.

## Object storage and CDN

Upload `apps/bridge/dist` after `pnpm verify`. Serve only over HTTPS. Set exact content types, immutable cache for hashed `assets/`, and no-cache for `index.html`, `sw.js`, and the manifest during rollout. Configure an error/route function that falls back to `index.html` only for extensionless application routes. Apply every security header at the CDN response layer.

Bucket access should be private to the CDN origin identity. Deployment credentials need write access only to the release prefix/bucket, not account administration. Disable directory listing and public write. Use versioning or immutable release prefixes for rollback.

## GitHub Pages

GitHub Pages cannot express the complete response-header baseline from repository files. It can demonstrate the static product, but a production workspace handling sensitive project data should use a host or fronting CDN that provides CSP, frame protection, MIME protection, referrer policy, permissions policy, and HSTS. Document the weaker environment prominently if Pages is used.

## Base paths

The canonical combined release needs no URL environment variables: its website uses `/app/`, and bridge links resolve through the current same-origin parent. For separate origins, set `NEXT_PUBLIC_BRIDGE_APP_URL=https://bridge.example.com/` for the website build and `VITE_WEBSITE_URL=https://www.example.com/` for the bridge build. Rebuild both artifacts after either value changes, then verify all three launch cards plus the bridge contact and privacy links.

The bridge artifact is otherwise configured for origin-root deployment. A subpath deployment needs a build-time Vite base path, manifest `start_url`/`scope`, service-worker scope, asset URL, SPA fallback, and link test aligned to that path. Treat this as a code/configuration change and run offline/deep-link/install tests; do not rewrite built files manually.

All header-capable production hosts should emit the checked-in `Strict-Transport-Security: max-age=31536000` policy only over HTTPS. The repository configurations intentionally omit `includeSubDomains` and `preload`; enabling either requires a separate domain-wide HTTPS readiness decision.
