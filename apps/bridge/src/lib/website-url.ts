type WebsitePath = "/contact/" | "/security-and-privacy/";

function normalizedWebsiteBase(configuredUrl?: string): string {
  const value = configuredUrl?.trim();
  if (!value) return "../";

  if (value.startsWith("/")) {
    if (value.startsWith("//")) {
      throw new Error("VITE_WEBSITE_URL must be a root-relative path or HTTPS URL.");
    }
    const parsed = new URL(value, "https://class-a-bridge.invalid");
    if (parsed.search || parsed.hash) {
      throw new Error("VITE_WEBSITE_URL must not contain a query string or fragment.");
    }
    return parsed.pathname.endsWith("/") ? parsed.pathname : `${parsed.pathname}/`;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("VITE_WEBSITE_URL must be a root-relative path or HTTPS URL.");
  }
  const localDevelopment =
    parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if ((!localDevelopment && parsed.protocol !== "https:") || parsed.username || parsed.password) {
    throw new Error("VITE_WEBSITE_URL must be an HTTPS URL without credentials.");
  }
  if (parsed.search || parsed.hash) {
    throw new Error("VITE_WEBSITE_URL must not contain a query string or fragment.");
  }
  if (!parsed.pathname.endsWith("/")) parsed.pathname = `${parsed.pathname}/`;
  return parsed.href;
}

export function websiteHref(path: WebsitePath, configuredUrl?: string): string {
  const environmentValue: unknown = import.meta.env.VITE_WEBSITE_URL;
  const websiteUrl =
    configuredUrl ?? (typeof environmentValue === "string" ? environmentValue : undefined);
  return `${normalizedWebsiteBase(websiteUrl)}${path.slice(1)}`;
}
