import type { NextConfig } from "next";

/**
 * Resolves the separately deployed backend origin that fronts `/api/v1`.
 *
 * Returns `null` when `BUNGAE_API_ORIGIN` is unset so local development keeps
 * `/v1` same-origin. Any configured value must be a bare http(s) origin:
 * credentials, a non-root path, a query string, or a fragment fail closed
 * because they would silently corrupt the proxied URL.
 */
function resolveBackendApiOrigin(rawOrigin: string | undefined): string | null {
  const trimmed = rawOrigin?.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(
      `BUNGAE_API_ORIGIN must be a valid http(s) origin (received ${JSON.stringify(trimmed)})`,
    );
  }

  const problems: string[] = [];
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    problems.push(`protocol must be http or https (got ${JSON.stringify(url.protocol)})`);
  }
  if (url.username !== "" || url.password !== "") {
    problems.push("must not contain credentials");
  }
  if (url.pathname !== "/") {
    problems.push(`must not contain a path (got ${JSON.stringify(url.pathname)})`);
  }
  if (url.search !== "") {
    problems.push(`must not contain a query string (got ${JSON.stringify(url.search)})`);
  }
  if (url.hash !== "") {
    problems.push(`must not contain a fragment (got ${JSON.stringify(url.hash)})`);
  }
  if (problems.length > 0) {
    throw new Error(
      `BUNGAE_API_ORIGIN must be a bare http(s) origin: ${problems.join("; ")} ` +
        `(received ${JSON.stringify(trimmed)})`,
    );
  }

  return url.origin;
}

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
];

const nextConfig: NextConfig = {
  agentRules: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  async rewrites() {
    const backendOrigin = resolveBackendApiOrigin(process.env.BUNGAE_API_ORIGIN);
    if (!backendOrigin) return [];
    return [
      {
        source: "/v1/:path*",
        destination: `${backendOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
