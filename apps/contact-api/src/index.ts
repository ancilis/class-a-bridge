const DEFAULT_BODY_LIMIT = 16 * 1024;
const MAXIMUM_RATE_LIMIT_KEYS = 100_000;
const CONTACT_FIELDS = new Set([
  "approvedSummary",
  "company",
  "email",
  "message",
  "name",
  "role",
  "website",
]);
// eslint-disable-next-line no-control-regex
const FORBIDDEN_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;

export interface ContactDelivery {
  readonly approvedSummary?: string;
  readonly company: string;
  readonly email: string;
  readonly message: string;
  readonly name: string;
  readonly receivedAt: string;
  readonly requestId: string;
  readonly role: string;
}

export type SafeLogEventName =
  | "contact.accepted"
  | "contact.bot_discarded"
  | "contact.delivery_failed"
  | "contact.rate_limit_failed"
  | "contact.rejected"
  | "contact.rate_limited";

export interface SafeLogEvent {
  readonly event: SafeLogEventName;
  readonly reason?:
    | "body_too_large"
    | "invalid_body"
    | "invalid_media_type"
    | "invalid_origin"
    | "invalid_request"
    | "method_not_allowed";
  readonly requestId: string;
  readonly status: number;
}

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export interface RateLimitStore {
  take(key: string, limit: number, windowMs: number, now: number): Promise<RateLimitResult>;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

/**
 * A bounded store for a single long-lived process. Multi-instance deployments
 * should provide a compatible shared store through `createContactHandler`.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  readonly #buckets = new Map<string, RateBucket>();
  readonly #maximumKeys: number;

  constructor(maximumKeys = 10_000) {
    if (
      !Number.isSafeInteger(maximumKeys) ||
      maximumKeys < 1 ||
      maximumKeys > MAXIMUM_RATE_LIMIT_KEYS
    ) {
      throw new Error("The in-memory rate-limit maximum key count must be between 1 and 100000");
    }
    this.#maximumKeys = maximumKeys;
  }

  take(key: string, limit: number, windowMs: number, now: number): Promise<RateLimitResult> {
    this.#prune(now);
    const bucketKey =
      this.#buckets.has(key) || this.#buckets.size < this.#maximumKeys ? key : "overflow";
    const existing = this.#buckets.get(bucketKey);
    const bucket =
      !existing || existing.resetAt <= now ? { count: 0, resetAt: now + windowMs } : existing;
    bucket.count += 1;
    this.#buckets.set(bucketKey, bucket);

    return Promise.resolve({
      allowed: bucket.count <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    });
  }

  #prune(now: number) {
    if (this.#buckets.size < this.#maximumKeys) return;
    for (const [key, bucket] of this.#buckets) {
      if (bucket.resetAt <= now) this.#buckets.delete(key);
    }
  }
}

export interface ContactHandlerOptions {
  readonly allowedOrigins: readonly string[];
  readonly bodyLimitBytes?: number;
  readonly deliver: (contact: ContactDelivery) => Promise<void>;
  readonly getClientKey: (request: Request) => Promise<string> | string;
  readonly logger?: (event: SafeLogEvent) => void;
  readonly now?: () => number;
  readonly path?: string;
  readonly rateLimit: {
    readonly limit: number;
    readonly store: RateLimitStore;
    readonly windowMs: number;
  };
  readonly requestId?: () => string;
}

interface ParsedContact {
  readonly approvedSummary?: string;
  readonly company: string;
  readonly email: string;
  readonly message: string;
  readonly name: string;
  readonly role: string;
  readonly website: string;
}

class RequestProblem extends Error {
  constructor(
    readonly status: number,
    readonly reason: SafeLogEvent["reason"],
  ) {
    super(reason);
  }
}

function originIsAllowed(origin: string | null, allowedOrigins: ReadonlySet<string>) {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return parsed.origin === origin && allowedOrigins.has(origin);
  } catch {
    return false;
  }
}

export function contactSecurityHeaders(origin?: string) {
  const headers = new Headers({
    "cache-control": "no-store",
    "content-security-policy":
      "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "content-type": "application/json; charset=utf-8",
    "cross-origin-resource-policy": "same-site",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "referrer-policy": "no-referrer",
    "strict-transport-security": "max-age=31536000",
    vary: "Origin",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  });
  if (origin) headers.set("access-control-allow-origin", origin);
  return headers;
}

function jsonResponse(status: number, body: unknown, origin?: string) {
  return new Response(JSON.stringify(body), {
    headers: contactSecurityHeaders(origin),
    status,
  });
}

async function readLimitedBody(request: Request, limit: number) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      throw new RequestProblem(400, "invalid_body");
    }
    if (parsedLength > limit) throw new RequestProblem(413, "body_too_large");
  }

  if (!request.body) throw new RequestProblem(400, "invalid_body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new RequestProblem(413, "body_too_large");
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new RequestProblem(400, "invalid_body");
  }
}

function normalizeText(value: unknown, maximumLength: number, required: boolean) {
  if (typeof value !== "string") throw new RequestProblem(400, "invalid_request");
  if (FORBIDDEN_CONTROL_CHARACTERS.test(value)) {
    throw new RequestProblem(400, "invalid_request");
  }
  const normalized = value.normalize("NFKC").replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  if ((required && normalized.length === 0) || normalized.length > maximumLength) {
    throw new RequestProblem(400, "invalid_request");
  }
  return normalized;
}

function parseContact(text: string): ParsedContact {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new RequestProblem(400, "invalid_body");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RequestProblem(400, "invalid_request");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !CONTACT_FIELDS.has(key))) {
    throw new RequestProblem(400, "invalid_request");
  }

  const website = normalizeText(record.website ?? "", 200, false);
  if (website) {
    return { company: "", email: "", message: "", name: "", role: "", website };
  }

  const email = normalizeText(record.email, 254, true).toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(email) || /[\r\n]/u.test(email)) {
    throw new RequestProblem(400, "invalid_request");
  }

  const approvedSummary = normalizeText(record.approvedSummary ?? "", 1_000, false);
  const base = {
    company: normalizeText(record.company ?? "", 160, false),
    email,
    message: normalizeText(record.message, 2_000, true),
    name: normalizeText(record.name, 120, true),
    role: normalizeText(record.role ?? "", 120, false),
    website,
  };
  return approvedSummary ? { ...base, approvedSummary } : base;
}

function safeLog(options: ContactHandlerOptions, event: SafeLogEvent) {
  try {
    options.logger?.(event);
  } catch {
    // Logging must never change the public response or expose contact values.
  }
}

export function createContactHandler(options: ContactHandlerOptions) {
  if (options.allowedOrigins.length === 0) {
    throw new Error("At least one contact origin is required");
  }
  for (const origin of options.allowedOrigins) {
    const parsed = new URL(origin);
    const localDevelopment = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (
      parsed.origin !== origin ||
      (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && localDevelopment))
    ) {
      throw new Error(
        "Contact origins must be exact HTTPS origins (HTTP is allowed for localhost only)",
      );
    }
  }
  if (
    !Number.isSafeInteger(options.rateLimit.limit) ||
    options.rateLimit.limit < 1 ||
    !Number.isSafeInteger(options.rateLimit.windowMs) ||
    options.rateLimit.windowMs < 1
  ) {
    throw new Error("Rate-limit values must be positive safe integers");
  }
  const allowedOrigins = new Set(options.allowedOrigins);
  const bodyLimit = options.bodyLimitBytes ?? DEFAULT_BODY_LIMIT;
  const contactPath = options.path ?? "/api/contact";
  if (!Number.isSafeInteger(bodyLimit) || bodyLimit < 1 || bodyLimit > DEFAULT_BODY_LIMIT) {
    throw new Error("The contact body limit must be between 1 and 16384 bytes");
  }
  if (!/^\/[a-z0-9/_-]+$/iu.test(contactPath)) {
    throw new Error("The contact path must be an absolute URL path without a query or fragment");
  }

  return async function handleContact(request: Request): Promise<Response> {
    const requestUrl = new URL(request.url);
    if (requestUrl.pathname !== contactPath || requestUrl.search || requestUrl.hash) {
      return jsonResponse(404, { accepted: false, code: "not_found" });
    }
    const requestId = options.requestId?.() ?? crypto.randomUUID();
    const origin = request.headers.get("origin");
    const allowedOrigin = originIsAllowed(origin, allowedOrigins)
      ? (origin ?? undefined)
      : undefined;

    if (!allowedOrigin) {
      safeLog(options, {
        event: "contact.rejected",
        reason: "invalid_origin",
        requestId,
        status: 403,
      });
      return jsonResponse(403, { accepted: false, code: "origin_not_allowed" });
    }

    if (request.method === "OPTIONS") {
      const requestedMethod = request.headers.get("access-control-request-method");
      const requestedHeaders = request.headers.get("access-control-request-headers");
      const asksForUnsupportedHeader = requestedHeaders
        ?.split(",")
        .some((header) => header.trim().toLowerCase() !== "content-type");
      if (requestedMethod !== "POST" || asksForUnsupportedHeader) {
        return jsonResponse(400, { accepted: false, code: "invalid_preflight" }, allowedOrigin);
      }
      const headers = contactSecurityHeaders(allowedOrigin);
      headers.set("access-control-allow-headers", "content-type");
      headers.set("access-control-allow-methods", "POST, OPTIONS");
      headers.set("access-control-max-age", "600");
      headers.delete("content-type");
      return new Response(null, { headers, status: 204 });
    }

    if (request.method !== "POST") {
      const response = jsonResponse(
        405,
        { accepted: false, code: "method_not_allowed" },
        allowedOrigin,
      );
      response.headers.set("allow", "POST, OPTIONS");
      safeLog(options, {
        event: "contact.rejected",
        reason: "method_not_allowed",
        requestId,
        status: 405,
      });
      return response;
    }

    const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (mediaType !== "application/json") {
      safeLog(options, {
        event: "contact.rejected",
        reason: "invalid_media_type",
        requestId,
        status: 415,
      });
      return jsonResponse(415, { accepted: false, code: "unsupported_media_type" }, allowedOrigin);
    }

    const now = options.now?.() ?? Date.now();
    let rate: RateLimitResult;
    try {
      const clientKey = await options.getClientKey(request);
      rate = await options.rateLimit.store.take(
        clientKey || "anonymous",
        options.rateLimit.limit,
        options.rateLimit.windowMs,
        now,
      );
    } catch {
      safeLog(options, { event: "contact.rate_limit_failed", requestId, status: 503 });
      return jsonResponse(503, { accepted: false, code: "temporarily_unavailable" }, allowedOrigin);
    }
    if (!rate.allowed) {
      const response = jsonResponse(429, { accepted: false, code: "rate_limited" }, allowedOrigin);
      response.headers.set("retry-after", String(rate.retryAfterSeconds));
      safeLog(options, { event: "contact.rate_limited", requestId, status: 429 });
      return response;
    }

    let contact: ParsedContact;
    try {
      contact = parseContact(await readLimitedBody(request, bodyLimit));
    } catch (error) {
      const problem =
        error instanceof RequestProblem ? error : new RequestProblem(400, "invalid_body");
      safeLog(options, {
        event: "contact.rejected",
        ...(problem.reason ? { reason: problem.reason } : {}),
        requestId,
        status: problem.status,
      });
      return jsonResponse(
        problem.status,
        { accepted: false, code: problem.status === 413 ? "body_too_large" : "invalid_request" },
        allowedOrigin,
      );
    }

    if (contact.website) {
      safeLog(options, { event: "contact.bot_discarded", requestId, status: 202 });
      return jsonResponse(202, { accepted: true }, allowedOrigin);
    }

    const delivery: ContactDelivery = {
      company: contact.company,
      email: contact.email,
      message: contact.message,
      name: contact.name,
      receivedAt: new Date(now).toISOString(),
      requestId,
      role: contact.role,
      ...(contact.approvedSummary ? { approvedSummary: contact.approvedSummary } : {}),
    };

    try {
      await options.deliver(delivery);
    } catch {
      safeLog(options, { event: "contact.delivery_failed", requestId, status: 503 });
      return jsonResponse(503, { accepted: false, code: "temporarily_unavailable" }, allowedOrigin);
    }

    safeLog(options, { event: "contact.accepted", requestId, status: 202 });
    return jsonResponse(202, { accepted: true }, allowedOrigin);
  };
}

export interface WebhookDeliveryOptions {
  readonly bearerToken?: string;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
  readonly url: string;
}

/** Creates a contact-only delivery adapter for an operator-controlled HTTPS endpoint. */
export function createWebhookDelivery(options: WebhookDeliveryOptions) {
  const destination = new URL(options.url);
  if (destination.protocol !== "https:" || destination.username || destination.password) {
    throw new Error("The contact delivery URL must be HTTPS and must not contain credentials");
  }
  const fetcher = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    throw new Error("The contact delivery timeout must be between 100 and 30000 milliseconds");
  }

  return async function deliverContact(contact: ContactDelivery) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-class-a-bridge-request-id": contact.requestId,
    };
    if (options.bearerToken) headers.authorization = `Bearer ${options.bearerToken}`;

    const response = await fetcher(destination.href, {
      body: JSON.stringify(contact),
      headers,
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error("Contact delivery was not accepted");
  };
}
