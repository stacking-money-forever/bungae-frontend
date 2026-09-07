import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_FCM_VAPID_KEY = "test-vapid-key";
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "test-api-key";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "test-project";
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = "123456";
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "1:123456:web:test";
});

import { FCM_VAPID_KEY, PUSH_DEVICE_STORAGE_KEY } from "@/lib/pwa/config";
import {
  readPushState,
  subscribeToPush,
  unsubscribeFromPush,
  type FcmClient,
  type PushDependencies,
} from "@/lib/pwa/push";
import type { PushDeviceApi } from "@/lib/pwa/push-device-api";
import { installLocalStorageStub } from "@/test/pwa-stubs";

function stubBrowser(permission: NotificationPermission = "default") {
  const registration = { active: {} as ServiceWorker } as ServiceWorkerRegistration;
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0",
  });
  Object.defineProperty(window.navigator, "serviceWorker", {
    configurable: true,
    value: { getRegistration: vi.fn().mockResolvedValue(registration) },
  });
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: {
      permission,
      requestPermission: vi.fn().mockResolvedValue("granted"),
    },
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: true }),
  });
  return registration;
}

type PushDeviceApiMocks = PushDeviceApi & {
  putDevice: Mock;
  deleteDevice: Mock;
};

function createDependencies(): {
  dependencies: PushDependencies;
  fcm: FcmClient;
  api: PushDeviceApiMocks;
} {
  const fcm: FcmClient = {
    isSupported: vi.fn().mockResolvedValue(true),
    getToken: vi.fn().mockResolvedValue("fcm-registration-token"),
    deleteToken: vi.fn().mockResolvedValue(true),
  };
  const api = {
    putDevice: vi.fn().mockResolvedValue(undefined),
    deleteDevice: vi.fn().mockResolvedValue(undefined),
  } as PushDeviceApiMocks;
  return {
    dependencies: {
      session: {
        subject: "user-1",
        getAccessToken: vi.fn().mockResolvedValue("jwt-for-this-request"),
      },
      api,
      fcm,
      now: () => new Date("2026-09-07T00:00:00.000Z"),
      createDeviceId: () => "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
    },
    fcm,
    api,
  };
}

describe("FCM push device lifecycle", () => {
  beforeEach(() => {
    installLocalStorageStub();
  });

  it("is unavailable without an injected authenticated session", async () => {
    stubBrowser();
    const fcm: FcmClient = {
      isSupported: vi.fn().mockResolvedValue(true),
      getToken: vi.fn(),
      deleteToken: vi.fn(),
    };

    await expect(readPushState({ fcm })).resolves.toEqual({
      support: "unavailable-auth",
      subscribed: false,
    });
    expect(fcm.isSupported).not.toHaveBeenCalled();
  });

  it("registers the FCM token with the approved device payload without storing it", async () => {
    const registration = stubBrowser();
    const { dependencies, fcm, api } = createDependencies();

    await expect(subscribeToPush(dependencies)).resolves.toEqual({
      ok: true,
      action: "subscribed",
      deviceId: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
    });
    expect(fcm.getToken).toHaveBeenCalledWith(registration, FCM_VAPID_KEY);
    expect(api.putDevice).toHaveBeenCalledWith(
      "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
      {
        platform: "ANDROID",
        token: "fcm-registration-token",
        lastSeenAt: "2026-09-07T00:00:00.000Z",
      },
      "jwt-for-this-request",
    );
    expect(window.localStorage.getItem(PUSH_DEVICE_STORAGE_KEY)).toBe(
      JSON.stringify({
        version: 1,
        subject: "user-1",
        deviceId: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
        state: "registered",
      }),
    );
    expect(window.localStorage.getItem(PUSH_DEVICE_STORAGE_KEY)).not.toContain("fcm-registration-token");
  });

  it("keeps a failed server registration retryable", async () => {
    stubBrowser();
    const { dependencies, api } = createDependencies();
    api.putDevice.mockRejectedValueOnce(new Error("network"));

    await expect(subscribeToPush(dependencies)).resolves.toEqual({ ok: false, reason: "server-failed" });
    expect(window.localStorage.getItem(PUSH_DEVICE_STORAGE_KEY)).toBeNull();

    await expect(subscribeToPush(dependencies)).resolves.toMatchObject({ ok: true });
    expect(api.putDevice).toHaveBeenCalledTimes(2);
  });

  it("blocks a new account until the previous owner deletes its device", async () => {
    stubBrowser();
    window.localStorage.setItem(
      PUSH_DEVICE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        subject: "user-1",
        deviceId: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
        state: "registered",
      }),
    );
    const { dependencies, fcm, api } = createDependencies();
    dependencies.session = {
      subject: "user-2",
      getAccessToken: vi.fn().mockResolvedValue("other-user-jwt"),
    };

    await expect(readPushState(dependencies)).resolves.toEqual({
      support: "account-switch-cleanup-required",
      subscribed: false,
    });
    await expect(subscribeToPush(dependencies)).resolves.toEqual({
      ok: false,
      reason: "account-switch-cleanup-required",
    });
    expect(fcm.getToken).not.toHaveBeenCalled();
    expect(api.putDevice).not.toHaveBeenCalled();
  });

  it("deletes the owner device before revoking the local FCM token", async () => {
    stubBrowser("granted");
    const { dependencies, fcm, api } = createDependencies();
    window.localStorage.setItem(
      PUSH_DEVICE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        subject: "user-1",
        deviceId: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
        state: "registered",
      }),
    );
    const order: string[] = [];
    api.deleteDevice = vi.fn().mockImplementation(async () => {
      order.push("server");
    });
    fcm.deleteToken = vi.fn().mockImplementation(async () => {
      order.push("fcm");
      return true;
    });

    await expect(unsubscribeFromPush(dependencies)).resolves.toEqual({ ok: true });
    expect(api.deleteDevice).toHaveBeenCalledWith(
      "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
      "jwt-for-this-request",
    );
    expect(order).toEqual(["server", "fcm"]);
    expect(window.localStorage.getItem(PUSH_DEVICE_STORAGE_KEY)).toBeNull();
  });

  it("retains a server-deleted record when local token deletion fails", async () => {
    stubBrowser("granted");
    const { dependencies, fcm } = createDependencies();
    window.localStorage.setItem(
      PUSH_DEVICE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        subject: "user-1",
        deviceId: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
        state: "registered",
      }),
    );
    fcm.deleteToken = vi.fn().mockRejectedValue(new Error("browser failure"));

    await expect(unsubscribeFromPush(dependencies)).resolves.toEqual({
      ok: false,
      reason: "local-token-delete-failed",
    });
    expect(window.localStorage.getItem(PUSH_DEVICE_STORAGE_KEY)).toContain("server-deleted");
  });

  it("reports storage unavailable when the stored record cannot be read", async () => {
    stubBrowser();
    const { dependencies } = createDependencies();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error("read blocked");
        },
      },
    });

    await expect(readPushState(dependencies)).resolves.toEqual({
      support: "storage-unavailable",
      subscribed: false,
    });
  });

  it("reports storage unavailable when malformed record cleanup cannot remove it", async () => {
    stubBrowser();
    const { dependencies } = createDependencies();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => "{not-json",
        removeItem: () => {
          throw new Error("remove blocked");
        },
      },
    });

    await expect(readPushState(dependencies)).resolves.toEqual({
      support: "storage-unavailable",
      subscribed: false,
    });
  });

  it("rolls back the server device when local persistence fails after PUT", async () => {
    stubBrowser();
    const { dependencies, api } = createDependencies();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error("write blocked");
        },
      },
    });

    await expect(subscribeToPush(dependencies)).resolves.toEqual({
      ok: false,
      reason: "local-storage-write-rolled-back",
    });
    expect(api.putDevice).toHaveBeenCalledTimes(1);
    expect(api.deleteDevice).toHaveBeenCalledWith(
      "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
      "jwt-for-this-request",
    );
  });

  it("cleans the exact orphan before allowing a normal registration again", async () => {
    stubBrowser();
    const { dependencies, fcm, api } = createDependencies();
    const store = new Map<string, string>();
    const setItem = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("write blocked");
      })
      .mockImplementation((key: string, value: string) => {
        store.set(key, value);
      });
    api.deleteDevice.mockRejectedValueOnce(new Error("initial rollback unavailable"));
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem,
        removeItem: (key: string) => store.delete(key),
      },
    });

    await expect(subscribeToPush(dependencies)).resolves.toEqual({
      ok: false,
      reason: "rollback-cleanup-required",
      deviceId: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
    });
    await expect(subscribeToPush(dependencies)).resolves.toEqual({
      ok: true,
      action: "cleanup-complete",
    });
    expect(api.putDevice).toHaveBeenCalledTimes(1);
    expect(fcm.getToken).toHaveBeenCalledTimes(1);
    expect(api.deleteDevice).toHaveBeenCalledTimes(2);
    expect(api.deleteDevice).toHaveBeenNthCalledWith(
      2,
      "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
      "jwt-for-this-request",
    );
    expect(fcm.deleteToken).toHaveBeenCalledTimes(1);

    await expect(subscribeToPush(dependencies)).resolves.toEqual({
      ok: true,
      action: "subscribed",
      deviceId: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
    });
    expect(api.putDevice).toHaveBeenCalledTimes(2);
  });

  it("retries cleanup against the same orphan without issuing another PUT", async () => {
    stubBrowser();
    const { dependencies, fcm, api } = createDependencies();
    api.deleteDevice
      .mockRejectedValueOnce(new Error("initial rollback unavailable"))
      .mockRejectedValueOnce(new Error("cleanup unavailable"))
      .mockRejectedValueOnce(new Error("cleanup unavailable"));
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error("write blocked");
        },
      },
    });

    const expectedRecovery = {
      ok: false,
      reason: "rollback-cleanup-required",
      deviceId: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
    };
    await expect(subscribeToPush(dependencies)).resolves.toEqual(expectedRecovery);
    await expect(subscribeToPush(dependencies)).resolves.toEqual(expectedRecovery);
    await expect(subscribeToPush(dependencies)).resolves.toEqual(expectedRecovery);
    expect(api.putDevice).toHaveBeenCalledTimes(1);
    expect(fcm.getToken).toHaveBeenCalledTimes(1);
    expect(api.deleteDevice).toHaveBeenCalledTimes(3);
    for (const [deviceId] of api.deleteDevice.mock.calls) {
      expect(deviceId).toBe("a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c");
    }

    await expect(subscribeToPush(dependencies)).resolves.toEqual({
      ok: true,
      action: "cleanup-complete",
    });
  });
});
