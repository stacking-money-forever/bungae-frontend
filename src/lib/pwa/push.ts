"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";

import { isIOSUserAgent, isStandaloneDisplay } from "@/lib/pwa/install-state";
import {
  FCM_VAPID_KEY,
  FIREBASE_WEB_CONFIG,
  PUSH_DEVICE_STORAGE_KEY,
  SERVICE_WORKER_PATH,
  hasFirebaseWebMessagingConfig,
} from "@/lib/pwa/config";
import {
  PushDeviceApiError,
  createPushDeviceApi,
  type PushDeviceApi,
  type PushDevicePlatform,
} from "@/lib/pwa/push-device-api";

const FIREBASE_APP_NAME = "bungae-push";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RollbackRecovery = {
  subject: string;
  deviceId: string;
};

// Volatile by design: a reload loses this handle, so backend retention must
// eventually remove device records whose clients cannot reconnect. While this
// page stays alive, it prevents an orphaned device from being multiplied.
let rollbackRecovery: RollbackRecovery | null = null;

type DeviceRecord = {
  version: 1;
  subject: string;
  deviceId: string;
  state: "registered" | "server-deleted";
};

export type PushAuthSession = {
  /** Stable authenticated subject, stored only with the device UUID to block cross-account reuse. */
  subject: string;
  /** Resolves the current JWT only for the request that needs it. */
  getAccessToken(): Promise<string | null>;
};

export type FcmClient = {
  isSupported(): Promise<boolean>;
  getToken(registration: ServiceWorkerRegistration, vapidKey: string): Promise<string>;
  deleteToken(): Promise<boolean>;
};

export type PushDependencies = {
  session?: PushAuthSession;
  api?: PushDeviceApi;
  fcm?: FcmClient;
  now?: () => Date;
  createDeviceId?: () => string | null;
};

export type PushSupportLevel =
  | "unavailable"
  | "requires-install"
  | "missing-fcm-config"
  | "unavailable-auth"
  | "account-switch-cleanup-required"
  | "rollback-cleanup-required"
  | "permission-denied"
  | "service-worker-unavailable"
  | "storage-unavailable"
  | "ready";

export type PushSubscriptionState = {
  support: PushSupportLevel;
  subscribed: boolean;
};

export type SubscribeResult =
  | { ok: true; action: "subscribed"; deviceId: string }
  | { ok: true; action: "cleanup-complete" }
  | {
      ok: false;
      reason:
        | Exclude<PushSupportLevel, "ready">
        | "token-unavailable"
        | "device-id-unavailable"
        | "server-failed"
        | "local-storage-write-rolled-back";
      deviceId?: string;
    };

export type UnsubscribeResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "unavailable-auth"
        | "account-switch-cleanup-required"
        | "storage-unavailable"
        | "server-failed"
        | "local-token-delete-failed";
    };

function defaultFcmClient(): FcmClient {
  const firebaseApp = () =>
    getApps().some((app) => app.name === FIREBASE_APP_NAME)
      ? getApp(FIREBASE_APP_NAME)
      : initializeApp(FIREBASE_WEB_CONFIG, FIREBASE_APP_NAME);
  const messaging = () => getMessaging(firebaseApp());

  return {
    isSupported,
    getToken(registration, vapidKey) {
      return getToken(messaging(), {
        vapidKey,
        serviceWorkerRegistration: registration,
      });
    },
    deleteToken() {
      return deleteToken(messaging());
    },
  };
}

function platform(): PushDevicePlatform | null {
  if (isIOSUserAgent()) return "IOS";
  return /Android/i.test(window.navigator.userAgent) ? "ANDROID" : null;
}

function storage(): Storage | null {
  try {
    const browserStorage = window.localStorage;
    browserStorage.getItem(PUSH_DEVICE_STORAGE_KEY);
    return browserStorage;
  } catch {
    return null;
  }
}

type DeviceRecordReadResult =
  | { ok: true; record: DeviceRecord | null }
  | { ok: false };

function removeDeviceRecord(browserStorage: Storage): boolean {
  try {
    browserStorage.removeItem(PUSH_DEVICE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function readDeviceRecord(browserStorage: Storage): DeviceRecordReadResult {
  try {
    const raw = browserStorage.getItem(PUSH_DEVICE_STORAGE_KEY);
    if (!raw) return { ok: true, record: null };
    const record = JSON.parse(raw) as Partial<DeviceRecord>;
    if (
      record.version === 1 &&
      typeof record.subject === "string" &&
      typeof record.deviceId === "string" &&
      UUID_PATTERN.test(record.deviceId) &&
      (record.state === "registered" || record.state === "server-deleted")
    ) {
      return { ok: true, record: record as DeviceRecord };
    }
  } catch {
    return { ok: false };
  }

  return removeDeviceRecord(browserStorage)
    ? { ok: true, record: null }
    : { ok: false };
}

function writeDeviceRecord(browserStorage: Storage, record: DeviceRecord): boolean {
  try {
    browserStorage.setItem(PUSH_DEVICE_STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

function hasValidSession(session: PushAuthSession | undefined): session is PushAuthSession {
  return Boolean(session?.subject.trim());
}

type PushContext = {
  support: PushSupportLevel;
  record: DeviceRecord | null;
  store: Storage | null;
  recovery?: RollbackRecovery;
};

async function resolveSupport(
  dependencies: PushDependencies,
): Promise<PushContext> {

  if (typeof window === "undefined" || !platform() || !("Notification" in window)) {
    return { support: "unavailable", record: null, store: null };
  }
  if (platform() === "IOS" && !isStandaloneDisplay()) {
    return { support: "requires-install", record: null, store: null };
  }
  if (!hasValidSession(dependencies.session)) {
    return { support: "unavailable-auth", record: null, store: null };
  }
  const store = storage();
  if (!store) return { support: "storage-unavailable", record: null, store: null };

  const recordResult = readDeviceRecord(store);
  if (!recordResult.ok) {
    return { support: "storage-unavailable", record: null, store: null };
  }
  const { record } = recordResult;
  if (rollbackRecovery) {
    if (rollbackRecovery.subject !== dependencies.session.subject) {
      return { support: "account-switch-cleanup-required", record, store };
    }
    return {
      support: "rollback-cleanup-required",
      record,
      store,
      recovery: rollbackRecovery,
    };
  }
  if (record?.subject !== undefined && record.subject !== dependencies.session.subject) {
    return { support: "account-switch-cleanup-required", record, store };
  }
  if (!hasFirebaseWebMessagingConfig()) {
    return { support: "missing-fcm-config", record, store };
  }
  if (Notification.permission === "denied") {
    return { support: "permission-denied", record, store };
  }
  if (!("serviceWorker" in navigator)) {
    return { support: "service-worker-unavailable", record, store };
  }

  try {
    const supported = await (dependencies.fcm ?? defaultFcmClient()).isSupported();
    if (!supported) return { support: "unavailable", record, store };
    const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_PATH);
    if (!registration?.active) {
      return { support: "service-worker-unavailable", record, store };
    }
  } catch {
    return { support: "unavailable", record, store };
  }

  return { support: "ready", record, store };
}

async function accessToken(session: PushAuthSession): Promise<string | null> {
  try {
    return await session.getAccessToken();
  } catch {
    return null;
  }
}

async function cleanupRollbackRecovery(
  recovery: RollbackRecovery,
  dependencies: PushDependencies,
): Promise<SubscribeResult> {
  if (!dependencies.session || recovery.subject !== dependencies.session.subject) {
    return { ok: false, reason: "account-switch-cleanup-required", deviceId: recovery.deviceId };
  }
  const token = await accessToken(dependencies.session);
  if (!token) return { ok: false, reason: "unavailable-auth", deviceId: recovery.deviceId };

  try {
    await (dependencies.api ?? createPushDeviceApi()).deleteDevice(recovery.deviceId, token);
    await (dependencies.fcm ?? defaultFcmClient()).deleteToken();
  } catch {
    return { ok: false, reason: "rollback-cleanup-required", deviceId: recovery.deviceId };
  }

  rollbackRecovery = null;
  return { ok: true, action: "cleanup-complete" };
}

export async function readPushState(
  dependencies: PushDependencies = {},
): Promise<PushSubscriptionState> {
  const { support, record } = await resolveSupport(dependencies);
  return {
    support,
    subscribed:
      support !== "account-switch-cleanup-required" &&
      support !== "rollback-cleanup-required" &&
      record?.state === "registered",
  };
}

/**
 * Exchanges the browser subscription for an FCM token, then sends that token
 * once to the authenticated device API. The token never enters localStorage or
 * a public return value.
 */
export async function subscribeToPush(
  dependencies: PushDependencies = {},
): Promise<SubscribeResult> {
  const context = await resolveSupport(dependencies);
  if (context.support === "rollback-cleanup-required" && context.recovery) {
    return cleanupRollbackRecovery(context.recovery, dependencies);
  }
  if (context.support !== "ready") {
    return { ok: false, reason: context.support };
  }
  if (!context.store) return { ok: false, reason: "storage-unavailable" };
  if (!dependencies.session) return { ok: false, reason: "unavailable-auth" };

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "permission-denied" };

  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_PATH);
  if (!registration?.active) return { ok: false, reason: "service-worker-unavailable" };

  const deviceId = context.record?.deviceId ?? dependencies.createDeviceId?.() ?? crypto.randomUUID?.();
  if (!deviceId || !UUID_PATTERN.test(deviceId)) {
    return { ok: false, reason: "device-id-unavailable" };
  }

  const token = await accessToken(dependencies.session);
  if (!token) return { ok: false, reason: "unavailable-auth" };

  let fcmToken: string;
  try {
    fcmToken = await (dependencies.fcm ?? defaultFcmClient()).getToken(registration, FCM_VAPID_KEY);
  } catch {
    return { ok: false, reason: "token-unavailable" };
  }
  if (!fcmToken) return { ok: false, reason: "token-unavailable" };

  try {
    await (dependencies.api ?? createPushDeviceApi()).putDevice(
      deviceId,
      {
        platform: platform() as PushDevicePlatform,
        token: fcmToken,
        lastSeenAt: (dependencies.now ?? (() => new Date()))().toISOString(),
      },
      token,
    );
  } catch (error) {
    if (error instanceof PushDeviceApiError && [401, 403].includes(error.status)) {
      return { ok: false, reason: "unavailable-auth" };
    }
    return { ok: false, reason: "server-failed" };
  }

  const record = {
    version: 1 as const,
    subject: dependencies.session.subject,
    deviceId,
    state: "registered" as const,
  };
  if (writeDeviceRecord(context.store, record)) {
    return { ok: true, action: "subscribed", deviceId };
  }

  rollbackRecovery = {
    subject: dependencies.session.subject,
    deviceId,
  };
  try {
    await (dependencies.api ?? createPushDeviceApi()).deleteDevice(deviceId, token);
    rollbackRecovery = null;
    return { ok: false, reason: "local-storage-write-rolled-back" };
  } catch {
    return { ok: false, reason: "rollback-cleanup-required", deviceId };
  }
}

/**
 * Caller must invoke this with the current owner session before logout or an
 * account change. A different account cannot delete an owner-only device.
 */
export async function unsubscribeFromPush(
  dependencies: PushDependencies = {},
): Promise<UnsubscribeResult> {
  if (!hasValidSession(dependencies.session)) {
    return { ok: false, reason: "unavailable-auth" };
  }
  const store = storage();
  if (!store) return { ok: false, reason: "storage-unavailable" };
  const recordResult = readDeviceRecord(store);
  if (!recordResult.ok) return { ok: false, reason: "storage-unavailable" };
  const { record } = recordResult;
  if (!record) return { ok: true };
  if (record.subject !== dependencies.session.subject) {
    return { ok: false, reason: "account-switch-cleanup-required" };
  }

  const token = await accessToken(dependencies.session);
  if (!token) return { ok: false, reason: "unavailable-auth" };

  if (record.state === "registered") {
    try {
      await (dependencies.api ?? createPushDeviceApi()).deleteDevice(record.deviceId, token);
    } catch (error) {
      if (error instanceof PushDeviceApiError && [401, 403].includes(error.status)) {
        return { ok: false, reason: "unavailable-auth" };
      }
      return { ok: false, reason: "server-failed" };
    }
    if (!writeDeviceRecord(store, { ...record, state: "server-deleted" })) {
      return { ok: false, reason: "storage-unavailable" };
    }
  }

  try {
    await (dependencies.fcm ?? defaultFcmClient()).deleteToken();
  } catch {
    return { ok: false, reason: "local-token-delete-failed" };
  }
  if (!removeDeviceRecord(store)) return { ok: false, reason: "storage-unavailable" };
  return { ok: true };
}
