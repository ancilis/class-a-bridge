import { describe, expect, it, vi } from "vitest";

import { createContactWorker } from "../src/worker";

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
});
