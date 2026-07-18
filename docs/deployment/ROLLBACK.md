# Production rollback

Class A Bridge uses immutable static release directories. Keep the immediately
previous verified release and its checksums available until the new release has
completed deployment validation.

1. Stop promotion of the affected release and preserve logs that exclude project data.
2. Repoint the hosting provider's production alias to the previous immutable release.
3. Purge only HTML and service-worker cache entries needed to activate the rollback;
   retain fingerprinted immutable assets.
4. Verify HTTPS, Content Security Policy, security headers, legal routes, `/app/`,
   offline loading, IndexedDB persistence, and the contact endpoint isolation.
5. Confirm that existing `.classabridge` backups still import. Do not delete browser
   project data as part of a website rollback.
6. Publish an accurate incident/release notice and record the restored release
   checksum, operator, time, reason, and validation evidence.

If a schema or project-model regression is involved, do not downgrade stored data
silently. Preserve an export, keep the recovery build available, and document the
supported migration path before asking users to reopen affected projects.
