import workerScript from "../../../public/sw.js?raw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

type WorkerHandler = (event: Record<string, unknown>) => void;

type CacheRecord = {
  match: Mock<(request: Request | string) => Promise<Response | undefined>>;
  put: Mock<(request: Request | string, response: Response) => Promise<void>>;
};

const handlers = new Map<string, WorkerHandler>();
const cacheRecords = new Map<string, CacheRecord>();
const cacheEntries = new Map<string, Map<string, Response>>();

function requestKey(request: Request | string) {
  return typeof request === "string" ? request : request.url;
}

function cacheFor(name: string): CacheRecord {
  const existing = cacheRecords.get(name);
  if (existing) return existing;

  const entries = cacheEntries.get(name) ?? new Map<string, Response>();
  cacheEntries.set(name, entries);
  const record = {
    match: vi.fn(async (request: Request | string) => entries.get(requestKey(request))?.clone()),
    put: vi.fn(async (request: Request | string, response: Response) => {
      entries.set(requestKey(request), response.clone());
    }),
  } as CacheRecord;
  cacheRecords.set(name, record);
  return record;
}

function basicResponse(body: string, init?: ResponseInit) {
  const response = new Response(body, init);
  Object.defineProperty(response, "type", { configurable: true, value: "basic" });
  return response;
}

function loadWorker() {
  handlers.clear();
  cacheRecords.clear();
  cacheEntries.clear();

  const clients = {
    claim: vi.fn().mockResolvedValue(undefined),
    matchAll: vi.fn().mockResolvedValue([]),
    openWindow: vi.fn().mockResolvedValue(undefined),
  };
  const worker = {
    location: new URL("https://bungae.example/sw.js"),
    registration: { showNotification: vi.fn().mockResolvedValue(undefined) },
    clients,
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn((type: string, handler: WorkerHandler) => {
      handlers.set(type, handler);
    }),
  };
  const cacheStorage = {
    open: vi.fn(async (name: string) => cacheFor(name)),
    keys: vi.fn(async () => Array.from(cacheEntries.keys())),
    delete: vi.fn(async (name: string) => {
      cacheRecords.delete(name);
      return cacheEntries.delete(name);
    }),
  };

  Object.defineProperty(globalThis, "self", { configurable: true, value: worker });
  Object.defineProperty(globalThis, "caches", { configurable: true, value: cacheStorage });
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: vi.fn() });
  return { cacheStorage, clients, worker };
}

function loadWorkerScript() {
  // The worker captures event handlers at evaluation, so each isolated test
  // executes fresh source after replacing its worker globals.
  new Function(workerScript)();
}

async function dispatch(type: string, event: Record<string, unknown>) {
  handlers.get(type)?.(event);
  const waitUntil = event.waitUntil as
    | { mock: { calls: [Promise<unknown>][] } }
    | undefined;
  await Promise.all((waitUntil?.mock.calls ?? []).map(([promise]) => promise));
}

describe("service worker", () => {
  beforeEach(() => {
    loadWorker();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an honest no-store offline page without caching navigations", async () => {
    const { cacheStorage } = loadWorker();
    const fetchMock = globalThis.fetch as Mock;
    fetchMock.mockRejectedValue(new Error("offline"));
    loadWorkerScript();

    const respondWith = vi.fn();
    const waitUntil = vi.fn();
    const targetUrl = "https://bungae.example/my-meetups?state=OPEN";
    await dispatch("fetch", {
      request: {
        method: "GET",
        mode: "navigate",
        url: targetUrl,
      },
      respondWith,
      waitUntil,
    });

    const response = await respondWith.mock.calls[0][0];
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.text();
    expect(body).toContain("인터넷 연결이 필요해요");
    // The retry re-navigates the attempted URL, escaped for safe embedding.
    expect(body).toContain('href="/my-meetups?state=OPEN"');
    expect(body).toContain('href="/"');
    expect(cacheStorage.open).not.toHaveBeenCalled();
  });

  it("caches only successful cacheable static assets and keeps the write alive", async () => {
    loadWorker();
    const fetchMock = globalThis.fetch as Mock;
    fetchMock.mockResolvedValue(basicResponse("asset", { status: 200 }));
    loadWorkerScript();

    const respondWith = vi.fn();
    const waitUntil = vi.fn();
    const request = new Request("https://bungae.example/icons/icon-192.png");
    await dispatch("fetch", { request, respondWith, waitUntil });

    expect((await respondWith.mock.calls[0][0]).status).toBe(200);
    await Promise.all(waitUntil.mock.calls.map(([promise]) => promise));
    expect(cacheFor("bungae-pwa-assets-v2").put).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValue(
      basicResponse("private", {
        status: 200,
        headers: { "cache-control": "private" },
      }),
    );
    const privateRespondWith = vi.fn();
    const privateWaitUntil = vi.fn();
    await dispatch("fetch", {
      request: new Request("https://bungae.example/icons/private.png"),
      respondWith: privateRespondWith,
      waitUntil: privateWaitUntil,
    });
    await Promise.all(privateWaitUntil.mock.calls.map(([promise]) => promise));
    expect(cacheFor("bungae-pwa-assets-v2").put).toHaveBeenCalledTimes(1);
  });

  it("deletes only stale app-owned cache names while retaining one rollback version", async () => {
    const { cacheStorage } = loadWorker();
    cacheFor("bungae-pwa-assets-v0");
    cacheFor("bungae-pwa-assets-v1");
    cacheFor("bungae-pwa-assets-v2");
    cacheFor("third-party-cache");
    loadWorkerScript();

    const waitUntil = vi.fn();
    await dispatch("activate", { waitUntil });

    expect(cacheStorage.delete).toHaveBeenCalledWith("bungae-pwa-assets-v0");
    expect(cacheStorage.delete).not.toHaveBeenCalledWith("third-party-cache");
    expect(cacheEntries.has("bungae-pwa-assets-v1")).toBe(true);
    expect(cacheEntries.has("bungae-pwa-assets-v2")).toBe(true);
  });

  it("opens only a same-origin path for a hostile notification destination", async () => {
    const { clients } = loadWorker();
    loadWorkerScript();

    const waitUntil = vi.fn();
    const close = vi.fn();
    await dispatch("notificationclick", {
      notification: { close, data: { url: "https://attacker.example/" } },
      waitUntil,
    });

    expect(close).toHaveBeenCalledOnce();
    expect(clients.openWindow).toHaveBeenCalledWith("/");
  });
});
