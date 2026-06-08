import { createExecutionContext, env, SELF, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("Worker API smoke tests", () => {
  it("responds with root status JSON (unit style)", async () => {
    const request = new IncomingRequest("http://example.com/");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type") ?? "").toContain("application/json");
    const body = (await response.json()) as { status?: string };
    expect(body.status).toBe("ok");
  });

  it("responds with health JSON (integration style)", async () => {
    const response = await SELF.fetch("https://example.com/health");

    expect(response.headers.get("content-type") ?? "").toContain("application/json");
    const body = (await response.json()) as {
      status?: string;
      missingTables?: string[];
      error?: { code?: string; message?: string };
    };

    // Health may be "ok" or "degraded" depending on test DB state.
    expect(["ok", "degraded", undefined]).toContain(body.status);
    if (body.status === "degraded") {
      expect(Array.isArray(body.missingTables)).toBe(true);
    }
    if (!body.status) {
      // If health probe itself fails, it should still return structured JSON.
      expect(body.error?.code).toBeDefined();
      expect(body.error?.message).toBeDefined();
    }
  });
});
