import {
  MemoryRateLimitStore,
  contactSecurityHeaders,
  createContactHandler,
  createWebhookDelivery,
  type RateLimitStore,
  type SafeLogEvent,
} from "./index.js";

export interface ContactWorkerEnvironment {
  readonly CONTACT_WEBSITE_ORIGIN: string;
  readonly CONTACT_WEBHOOK_TOKEN?: string;
  readonly CONTACT_WEBHOOK_URL: string;
}

export interface ContactWorkerOptions {
  readonly fetch?: typeof fetch;
  readonly logger?: (event: SafeLogEvent) => void;
  readonly rateLimitStore?: RateLimitStore;
}

const sharedRateLimitStore = new MemoryRateLimitStore();

export function createContactWorker(
  environment: ContactWorkerEnvironment,
  options: ContactWorkerOptions = {},
) {
  if (!environment.CONTACT_WEBSITE_ORIGIN) {
    throw new Error("CONTACT_WEBSITE_ORIGIN is required");
  }
  if (!environment.CONTACT_WEBHOOK_URL) {
    throw new Error("CONTACT_WEBHOOK_URL is required");
  }

  return createContactHandler({
    allowedOrigins: [environment.CONTACT_WEBSITE_ORIGIN],
    deliver: createWebhookDelivery({
      ...(environment.CONTACT_WEBHOOK_TOKEN
        ? { bearerToken: environment.CONTACT_WEBHOOK_TOKEN }
        : {}),
      ...(options.fetch ? { fetch: options.fetch } : {}),
      url: environment.CONTACT_WEBHOOK_URL,
    }),
    getClientKey(request) {
      return request.headers.get("cf-connecting-ip")?.trim().slice(0, 256) || "anonymous";
    },
    logger: options.logger ?? ((event) => console.info(JSON.stringify(event))),
    rateLimit: {
      limit: 5,
      store: options.rateLimitStore ?? sharedRateLimitStore,
      windowMs: 60 * 60 * 1000,
    },
  });
}

export default {
  async fetch(request: Request, environment: ContactWorkerEnvironment): Promise<Response> {
    try {
      return await createContactWorker(environment)(request);
    } catch {
      return new Response(JSON.stringify({ accepted: false, code: "temporarily_unavailable" }), {
        headers: contactSecurityHeaders(),
        status: 503,
      });
    }
  },
};
