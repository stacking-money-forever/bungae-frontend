/**
 * Shared PWA transport constants. Client-facing Firebase values identify the
 * web app; JWTs and FCM registration tokens never belong in this module or in
 * browser storage.
 */
export const SERVICE_WORKER_PATH = "/sw.js";
export const SERVICE_WORKER_SCOPE = "/";
export const API_BASE_URL = "/v1";

export const PUSH_DEVICE_STORAGE_KEY = "bungae.push.device";
export const FCM_VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY ?? "";

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId: string;
  appId: string;
};

/**
 * Firebase's modular SDK is required to exchange the browser subscription for
 * the FCM registration token accepted by the existing backend contract.
 */
export const FIREBASE_WEB_CONFIG: FirebaseWebConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || undefined,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || undefined,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

export function hasFirebaseWebMessagingConfig(): boolean {
  return Boolean(
    FCM_VAPID_KEY &&
      FIREBASE_WEB_CONFIG.apiKey &&
      FIREBASE_WEB_CONFIG.projectId &&
      FIREBASE_WEB_CONFIG.messagingSenderId &&
      FIREBASE_WEB_CONFIG.appId,
  );
}
