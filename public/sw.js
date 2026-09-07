/**
 * 벙개 service worker.
 *
 * Cache version policy:
 * - Increment CACHE_VERSION for each cache-format change.
 * - Keep the immediately preceding app-owned cache version so a deployment
 *   rollback can still serve its immutable assets offline.
 * - New workers wait by default. They activate early only after the app sends
 *   SKIP_WAITING from the explicit update action.
 *
 * User and authenticated documents are never cached. Only successful,
 * same-origin immutable static assets may be stored.
 */

const CACHE_VERSION = "v2";
const PREVIOUS_CACHE_VERSION = "v1";
const CACHE_PREFIX = "bungae-pwa-assets-";
const ASSET_CACHE = `${CACHE_PREFIX}${CACHE_VERSION}`;
const RETAINED_CACHES = new Set([
  ASSET_CACHE,
  `${CACHE_PREFIX}${PREVIOUS_CACHE_VERSION}`,
]);

function isOwnedCacheName(name) {
  return name.startsWith(CACHE_PREFIX);
}

function isCacheableAssetResponse(response) {
  const cacheControl = response.headers.get("cache-control") ?? "";
  return (
    response.status === 200 &&
    response.type === "basic" &&
    !/\b(?:no-store|private)\b/i.test(cacheControl)
  );
}

// Fallback document shown when a navigation cannot reach the network while
// the worker controls the page. It must stay readable with JavaScript
// disabled and must never contain or cache user/authenticated content. The
// retry link re-navigates the URL the user actually tried to reach.
function offlineResponse(request) {
  const attemptedUrl =
    request && typeof request.url === "string" ? request.url : "/";
  const destination = safeInternalPath(attemptedUrl);
  const escapedDestination = destination
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return new Response(
    `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>오프라인</title><body style="margin:0;font-family:system-ui,sans-serif;background:#FBFAF7;color:#161616"><main style="max-width:390px;margin:0 auto;padding:48px 24px"><h1 style="font-size:24px">인터넷 연결이 필요해요</h1><p>연결을 확인한 뒤 다시 시도해 주세요.</p><p style="margin-top:24px"><a href="${escapedDestination}" style="display:inline-block;background:#FFD60A;border-radius:999px;padding:12px 24px;font-weight:700;color:#161616;text-decoration:none">다시 시도</a></p><p style="margin-top:16px"><a href="/" style="color:#161616">홈으로</a></p></main></body></html>`,
    {
      status: 503,
      statusText: "Service Unavailable",
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

function safeInternalPath(value) {
  try {
    const url = new URL(typeof value === "string" ? value : "/", self.location.origin);
    if (url.origin !== self.location.origin) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

self.addEventListener("install", () => {
  // No app shell pre-cache: document responses may be authenticated or
  // user-specific. The browser keeps this worker waiting during an update.
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => isOwnedCacheName(key) && !RETAINED_CACHES.has(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => offlineResponse(request)));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        if (isCacheableAssetResponse(response)) {
          event.waitUntil(cache.put(request, response.clone()).catch(() => undefined));
        }
        return response;
      }),
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const title = typeof payload.title === "string" ? payload.title : "벙개";
  const body = typeof payload.body === "string" ? payload.body : "";
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: typeof payload.tag === "string" ? payload.tag : undefined,
      data: { url: safeInternalPath(payload.url) },
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-maskable-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeInternalPath(event.notification.data?.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.focus().then(() =>
            "navigate" in client ? client.navigate(target) : undefined,
          );
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
