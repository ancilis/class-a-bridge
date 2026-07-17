import { describe, expect, it, vi } from "vitest";

import {
  MemoryRateLimitStore,
  createContactHandler,
  createWebhookDelivery,
  type ContactDelivery,
  type SafeLogEvent,
} from "../src/index";

const allowedOrigin = "https://classabridge.example";

function contactRequest(
  body: unknown,
  init: { contentType?: string; method?: string; origin?: string; path?: string } = {},
) {
  const encoded = JSON.stringify(body);
  const method = init.method ?? "POST";
  return new Request(`https://contact.example${init.path ?? "/api/contact"}`, {
    ...(method === "GET" ? {} : { body: encoded }),
    headers: {
      "content-length": String(new TextEncoder().encode(encoded).byteLength),
      "content-type": init.contentType ?? "application/json",
      origin: init.origin ?? allowedOrigin,
    },
    method,
  });
}

const validContact = {
  approvedSummary: "We want a scope review before setting a target date.",
  company: "Example Cloud",
  email: "jordan@example.test",
  message: "Please contact us about a Class A readiness review.",
  name: "Jordan Lee",
  role: "GRC manager",
};

function setup(options: { limit?: number } = {}) {
  const deliveries: ContactDelivery[] = [];
  const logs: SafeLogEvent[] = [];
  const handler = createContactHandler({
    allowedOrigins: [allowedOrigin],
    deliver: (contact) => {
      deliveries.push(contact);
      return Promise.resolve();
    },
    getClientKey: () => "test-client",
    logger: (event) => logs.push(event),
    rateLimit: {
      limit: options.limit ?? 5,
      store: new MemoryRateLimitStore(),
      windowMs: 60_000,
    },
  });
  return { deliveries, handler, logs };
}

describe("optional contact endpoint", () => {
  it("does not expose the contact handler on another path", async () => {
    const { deliveries, handler } = setup();

    const response = await handler(contactRequest(validContact, { path: "/project/import" }));

    expect(response.status).toBe(404);
    expect(deliveries).toHaveLength(0);
  });

  it("refuses an insecure non-local website origin", () => {
    expect(() =>
      createContactHandler({
        allowedOrigins: ["http://public.example"],
        deliver: () => Promise.resolve(),
        getClientKey: () => "test-client",
        rateLimit: { limit: 5, store: new MemoryRateLimitStore(), windowMs: 60_000 },
      }),
    ).toThrow("HTTPS");
  });

  it("does not allow operators to raise the contact body limit", () => {
    expect(() =>
      createContactHandler({
        allowedOrigins: [allowedOrigin],
        bodyLimitBytes: 16 * 1024 + 1,
        deliver: () => Promise.resolve(),
        getClientKey: () => "test-client",
        rateLimit: { limit: 5, store: new MemoryRateLimitStore(), windowMs: 60_000 },
      }),
    ).toThrow("body limit");
  });

  it("accepts only validated contact fields and returns restrictive headers", async () => {
    const { deliveries, handler } = setup();

    const response = await handler(contactRequest(validContact));

    expect(response.status).toBe(202);
    expect(deliveries).toEqual([
      {
        ...validContact,
        receivedAt: expect.any(String),
        requestId: expect.any(String),
      },
    ]);
    expect(response.headers.get("access-control-allow-origin")).toBe(allowedOrigin);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
    await expect(response.json()).resolves.toEqual({ accepted: true });
  });

  it("rejects unknown fields including assessment and document content", async () => {
    const { deliveries, handler } = setup();

    const response = await handler(
      contactRequest({
        ...validContact,
        evidence: [{ title: "Production access review" }],
        project: { answers: { soc2TypeII: "yes" } },
      }),
    );

    expect(response.status).toBe(400);
    expect(deliveries).toHaveLength(0);
    await expect(response.json()).resolves.toEqual({
      accepted: false,
      code: "invalid_request",
    });
  });

  it("accepts international Unicode text while rejecting control characters", async () => {
    const { deliveries, handler } = setup();
    const accepted = await handler(
      contactRequest({
        ...validContact,
        message: "Please contact me about our scope review. 🔐",
        name: "𐐀na García",
      }),
    );
    const rejected = await handler(
      contactRequest({ ...validContact, message: "unsafe\u0000message" }),
    );

    expect(accepted.status).toBe(202);
    expect(deliveries[0]?.name).toBe("𐐀na García");
    expect(rejected.status).toBe(400);
    expect(deliveries).toHaveLength(1);
  });

  it("rejects missing or unapproved origins before reading contact data", async () => {
    const { deliveries, handler } = setup();

    const response = await handler(
      contactRequest(validContact, { origin: "https://attacker.test" }),
    );

    expect(response.status).toBe(403);
    expect(deliveries).toHaveLength(0);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rejects unsupported methods and media types", async () => {
    const { handler } = setup();

    const methodResponse = await handler(contactRequest(validContact, { method: "GET" }));
    const mediaResponse = await handler(
      contactRequest(validContact, { contentType: "text/plain" }),
    );

    expect(methodResponse.status).toBe(405);
    expect(methodResponse.headers.get("allow")).toBe("POST, OPTIONS");
    expect(mediaResponse.status).toBe(415);
  });

  it("enforces the body limit even when content-length is absent or dishonest", async () => {
    const { handler } = setup();
    const oversized = "x".repeat(17_000);
    const request = new Request("https://contact.example/api/contact", {
      body: JSON.stringify({ ...validContact, message: oversized }),
      headers: { "content-type": "application/json", origin: allowedOrigin },
      method: "POST",
    });

    const response = await handler(request);

    expect(response.status).toBe(413);
  });

  it("treats a filled honeypot as accepted without delivery", async () => {
    const { deliveries, handler } = setup();

    const response = await handler(contactRequest({ ...validContact, website: "spam.test" }));

    expect(response.status).toBe(202);
    expect(deliveries).toHaveLength(0);
  });

  it("limits repeated requests by client key", async () => {
    const { deliveries, handler } = setup({ limit: 1 });

    const first = await handler(contactRequest(validContact));
    const second = await handler(contactRequest(validContact));

    expect(first.status).toBe(202);
    expect(second.status).toBe(429);
    expect(second.headers.get("retry-after")).toBe("60");
    expect(deliveries).toHaveLength(1);
  });

  it("fails closed when the rate-limit service is unavailable", async () => {
    const logs: SafeLogEvent[] = [];
    const handler = createContactHandler({
      allowedOrigins: [allowedOrigin],
      deliver: () => Promise.resolve(),
      getClientKey: () => "test-client",
      logger: (event) => logs.push(event),
      rateLimit: {
        limit: 5,
        store: {
          take: () => Promise.reject(new Error(`store leak: ${validContact.email}`)),
        },
        windowMs: 60_000,
      },
    });

    const response = await handler(contactRequest(validContact));

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain(validContact.email);
    expect(logs.at(-1)).toMatchObject({ event: "contact.rate_limit_failed", status: 503 });
  });

  it("never records contact values in logs, including delivery failures", async () => {
    const logs: SafeLogEvent[] = [];
    const failure = new Error(`delivery failed for ${validContact.email}: ${validContact.message}`);
    const handler = createContactHandler({
      allowedOrigins: [allowedOrigin],
      deliver: () => Promise.reject(failure),
      getClientKey: () => "test-client",
      logger: (event) => logs.push(event),
      rateLimit: { limit: 5, store: new MemoryRateLimitStore(), windowMs: 60_000 },
    });

    const response = await handler(contactRequest(validContact));
    const serializedLogs = JSON.stringify(logs);

    expect(response.status).toBe(503);
    expect(serializedLogs).not.toContain(validContact.email);
    expect(serializedLogs).not.toContain(validContact.message);
    expect(serializedLogs).not.toContain("delivery failed");
    expect(logs.at(-1)).toMatchObject({ event: "contact.delivery_failed", status: 503 });
  });

  it("allows a valid preflight only for configured origins", async () => {
    const { handler } = setup();
    const request = new Request("https://contact.example/api/contact", {
      headers: {
        "access-control-request-headers": "content-type",
        "access-control-request-method": "POST",
        origin: allowedOrigin,
      },
      method: "OPTIONS",
    });

    const response = await handler(request);

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
  });

  it("does not expose a delivery exception body", async () => {
    const logger = vi.fn();
    const handler = createContactHandler({
      allowedOrigins: [allowedOrigin],
      deliver: () => Promise.reject(new Error("secret provider response")),
      getClientKey: () => "test-client",
      logger,
      rateLimit: { limit: 5, store: new MemoryRateLimitStore(), windowMs: 60_000 },
    });

    const response = await handler(contactRequest(validContact));

    expect(await response.text()).not.toContain("secret provider response");
  });
});

describe("contact webhook delivery", () => {
  it("refuses a non-HTTPS destination", () => {
    expect(() => createWebhookDelivery({ url: "http://internal.test/contact" })).toThrow("HTTPS");
  });

  it("sends the validated contact record without redirects", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const deliver = createWebhookDelivery({
      bearerToken: "delivery-secret",
      fetch: fetcher,
      url: "https://crm.example.test/contact",
    });
    const contact: ContactDelivery = {
      ...validContact,
      receivedAt: "2026-07-17T12:00:00.000Z",
      requestId: "request-1",
    };

    await deliver(contact);

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("https://crm.example.test/contact");
    expect(init).toMatchObject({
      headers: {
        authorization: "Bearer delivery-secret",
        "content-type": "application/json",
      },
      method: "POST",
      redirect: "error",
    });
    expect(typeof init?.body).toBe("string");
    expect(JSON.parse(init?.body as string)).toEqual(contact);
  });

  it("fails closed when the delivery service does not accept the record", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("provider detail that must not be propagated", { status: 500 }),
      );
    const deliver = createWebhookDelivery({
      fetch: fetcher,
      url: "https://crm.example.test/contact",
    });

    await expect(
      deliver({
        ...validContact,
        receivedAt: "2026-07-17T12:00:00.000Z",
        requestId: "request-1",
      }),
    ).rejects.toThrow("Contact delivery was not accepted");
  });
});
