export type AssessmentStart = "report" | "manual" | "sample";

const DEFAULT_BRIDGE_APP_URL = "/app/";

function normalizedAppBase(configuredUrl?: string): string {
  const value = configuredUrl?.trim() || DEFAULT_BRIDGE_APP_URL;

  if (value.startsWith("/")) {
    if (value.startsWith("//")) {
      throw new Error("NEXT_PUBLIC_BRIDGE_APP_URL must be a root-relative path or HTTPS URL.");
    }
    const parsed = new URL(value, "https://class-a-bridge.invalid");
    if (parsed.search || parsed.hash) {
      throw new Error("NEXT_PUBLIC_BRIDGE_APP_URL must not contain a query string or fragment.");
    }
    return parsed.pathname.endsWith("/") ? parsed.pathname : `${parsed.pathname}/`;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_BRIDGE_APP_URL must be a root-relative path or HTTPS URL.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("NEXT_PUBLIC_BRIDGE_APP_URL must be an HTTPS URL without credentials.");
  }
  if (parsed.search || parsed.hash) {
    throw new Error("NEXT_PUBLIC_BRIDGE_APP_URL must not contain a query string or fragment.");
  }
  if (!parsed.pathname.endsWith("/")) parsed.pathname = `${parsed.pathname}/`;
  return parsed.href;
}

export function bridgeAppHref(
  start: AssessmentStart,
  configuredUrl = process.env.NEXT_PUBLIC_BRIDGE_APP_URL,
): string {
  return `${normalizedAppBase(configuredUrl)}?start=${start}`;
}
