import { afterEach, describe, expect, it } from "vitest";

import nextConfig from "../../../next.config";

const originalBackendOrigin = process.env.BUNGAE_API_ORIGIN;

function rewrites() {
  expect(typeof nextConfig.rewrites).toBe("function");
  return nextConfig.rewrites!();
}

afterEach(() => {
  if (originalBackendOrigin === undefined) {
    delete process.env.BUNGAE_API_ORIGIN;
  } else {
    process.env.BUNGAE_API_ORIGIN = originalBackendOrigin;
  }
});

describe("backend /v1 rewrite", () => {
  it("keeps agentRules disabled so next dev never rewrites repo agent docs", () => {
    expect(nextConfig.agentRules).toBe(false);
  });

  it("returns no rewrite when BUNGAE_API_ORIGIN is absent", async () => {
    delete process.env.BUNGAE_API_ORIGIN;
    await expect(rewrites()).resolves.toEqual([]);
  });

  it("returns no rewrite when BUNGAE_API_ORIGIN is blank", async () => {
    process.env.BUNGAE_API_ORIGIN = "   ";
    await expect(rewrites()).resolves.toEqual([]);
  });

  it("maps same-origin /v1/:path* to <origin>/api/v1/:path*", async () => {
    process.env.BUNGAE_API_ORIGIN = "https://api.bungae.example.com";
    await expect(rewrites()).resolves.toEqual([
      {
        source: "/v1/:path*",
        destination: "https://api.bungae.example.com/api/v1/:path*",
      },
    ]);
  });

  it("preserves a non-default port in the backend origin", async () => {
    process.env.BUNGAE_API_ORIGIN = "http://127.0.0.1:8080";
    await expect(rewrites()).resolves.toEqual([
      {
        source: "/v1/:path*",
        destination: "http://127.0.0.1:8080/api/v1/:path*",
      },
    ]);
  });

  it("accepts an explicit root path on the origin", async () => {
    process.env.BUNGAE_API_ORIGIN = "https://api.bungae.example.com/";
    await expect(rewrites()).resolves.toEqual([
      {
        source: "/v1/:path*",
        destination: "https://api.bungae.example.com/api/v1/:path*",
      },
    ]);
  });

  it.each([
    ["not a URL", "bungae-api"],
    ["a non-http(s) scheme", "ftp://api.bungae.example.com"],
    ["credentials", "https://user:secret@api.bungae.example.com"],
    ["a non-root path", "https://api.bungae.example.com/backend"],
    ["a query string", "https://api.bungae.example.com/?region=kr"],
    ["a fragment", "https://api.bungae.example.com/#v1"],
  ])("fails closed when BUNGAE_API_ORIGIN has %s", async (_label, value) => {
    process.env.BUNGAE_API_ORIGIN = value;
    await expect(rewrites()).rejects.toThrow(/BUNGAE_API_ORIGIN/);
  });
});

describe("baseline security headers", () => {
  it("returns the exact header set for every route", async () => {
    expect(typeof nextConfig.headers).toBe("function");
    await expect(nextConfig.headers!()).resolves.toEqual([
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ]);
  });

});
