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

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function asObject(value) {
  return value && typeof value === "object" ? value : {};
}

// Accepts both the FCM web push envelope ({ notification, data, fcmOptions })
// and a flat { title, body, url, tag } payload.
function notificationFromPayload(payload) {
  const notification = asObject(payload.notification);
  const data = asObject(payload.data);
  const fcmOptions = asObject(payload.fcmOptions);
  return {
    title: firstString(notification.title, data.title, payload.title) ?? "벙개",
    body: firstString(notification.body, data.body, payload.body) ?? "",
    tag: firstString(notification.tag, data.tag, payload.tag),
    url: safeInternalPath(firstString(data.url, fcmOptions.link, payload.url)),
  };
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = asObject(event.data ? event.data.json() : {});
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  const { title, body, tag, url } = notificationFromPayload(payload);
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: { url },
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-maskable-192.png",
    }),
  );
});

const NAVIGATE_ACK_TIMEOUT_MS = 1500;

// Asks an open window to route client-side and resolves true once it
// acknowledges. A window running an older bundle, an error screen, or a page
// that has not hydrated never answers.
function requestClientNavigation(client, url) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(false), NAVIGATE_ACK_TIMEOUT_MS);
    channel.port1.onmessage = () => {
      clearTimeout(timer);
      resolve(true);
    };
    client.postMessage({ type: "NAVIGATE", url }, [channel.port2]);
  });
}

// An open app window is asked to route client-side (NAVIGATE message) instead
// of being reloaded: the session lives only in page memory, so a document
// navigation would sign the user out. Only when the window does not answer is
// it navigated as a document, so the destination is never lost.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeInternalPath(event.notification.data?.url);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.focus().then(async (focused) => {
            const windowClient = focused ?? client;
            if (await requestClientNavigation(windowClient, target)) return undefined;
            return "navigate" in windowClient ? windowClient.navigate(target) : self.clients.openWindow(target);
          });
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
