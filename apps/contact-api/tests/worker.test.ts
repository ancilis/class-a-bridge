import { describe, expect, it, vi } from "vitest";

import { MemoryRateLimitStore } from "../src/index";
import workerModule, { createContactWorker } from "../src/worker";

describe("Cloudflare contact worker adapter", () => {
  it("delivers a website contact through the configured HTTPS webhook", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const worker = createContactWorker(
      {
        CONTACT_WEBSITE_ORIGIN: "https://classabridge.ancilis.com",
        CONTACT_WEBHOOK_TOKEN: "worker-secret",
        CONTACT_WEBHOOK_URL: "https://contact-delivery.ancilis.com/intake",
      },
      { fetch: fetcher, logger: () => undefined },
    );
    const body = JSON.stringify({
      company: "Example Cloud",
      email: "jordan@example.test",
      message: "Please contact us about a readiness review.",
      name: "Jordan Lee",
      role: "GRC manager",
    });
    const request = new Request("https://contact-api.ancilis.com/api/contact", {
      body,
      headers: {
        "cf-connecting-ip": "192.0.2.10",
        "content-length": String(new TextEncoder().encode(body).byteLength),
        "content-type": "application/json",
        origin: "https://classabridge.ancilis.com",
      },
      method: "POST",
    });

    const response = await worker(request);

    expect(response.status).toBe(202);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://contact-delivery.ancilis.com/intake");
  });

  it("validates required environment at adapter creation", () => {
    expect(() =>
      createContactWorker({
        CONTACT_WEBSITE_ORIGIN: "",
        CONTACT_WEBHOOK_URL: "",
      }),
    ).toThrow("CONTACT_WEBSITE_ORIGIN");
  });

  it("enforces the documented five-request worker limit for one client key", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const worker = createContactWorker(
      {
        CONTACT_WEBSITE_ORIGIN: "https://classabridge.ancilis.com",
        CONTACT_WEBHOOK_URL: "https://contact-delivery.ancilis.com/intake",
      },
      {
        fetch: fetcher,
        logger: () => undefined,
        rateLimitStore: new MemoryRateLimitStore(),
      },
    );
    const body = JSON.stringify({
      email: "jordan@example.test",
      message: "Please contact us about a readiness review.",
      name: "Jordan Lee",
    });
    const createRequest = () =>
      new Request("https://contact-api.ancilis.com/api/contact", {
        body,
        headers: {
          "cf-connecting-ip": "192.0.2.20",
          "content-type": "application/json",
          origin: "https://classabridge.ancilis.com",
        },
        method: "POST",
      });

    const responses = [];
    for (let index = 0; index < 6; index += 1) responses.push(await worker(createRequest()));

    expect(responses.map(({ status }) => status)).toEqual([202, 202, 202, 202, 202, 429]);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it("returns the complete restrictive header baseline when configuration is unavailable", async () => {
    const response = await workerModule.fetch(
      new Request("https://contact-api.ancilis.com/api/contact"),
      {
        CONTACT_WEBSITE_ORIGIN: "",
        CONTACT_WEBHOOK_URL: "",
      },
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
    expect(response.headers.get("permissions-policy")).toContain("camera=()");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
  });
});
