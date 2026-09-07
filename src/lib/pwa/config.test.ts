import { describe, expect, it } from "vitest";

import {
  API_BASE_URL,
  FIREBASE_WEB_CONFIG,
  PUSH_DEVICE_STORAGE_KEY,
  hasFirebaseWebMessagingConfig,
} from "@/lib/pwa/config";

describe("PWA push configuration", () => {
  it("keeps the approved API prefix and stores no registration token key", () => {
    expect(API_BASE_URL).toBe("/v1");
    expect(PUSH_DEVICE_STORAGE_KEY).toBe("bungae.push.device");
  });

  it("requires the Firebase fields needed to request an FCM token", () => {
    expect(typeof FIREBASE_WEB_CONFIG.apiKey).toBe("string");
    expect(typeof FIREBASE_WEB_CONFIG.projectId).toBe("string");
    expect(typeof FIREBASE_WEB_CONFIG.messagingSenderId).toBe("string");
    expect(typeof FIREBASE_WEB_CONFIG.appId).toBe("string");
    expect(typeof hasFirebaseWebMessagingConfig()).toBe("boolean");
  });
});
