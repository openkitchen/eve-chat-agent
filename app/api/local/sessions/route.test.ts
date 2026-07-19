// @vitest-environment node

import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/local/sessions", () => {
  it("serves the allowlisted session index for a production-style request", async () => {
    const response = await GET(new Request("https://example.test/api/local/sessions"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      source: "eve-local-run-manifests",
      truncated: false,
    });
  });
});
