import { useSyncExternalStore } from "react";

/**
 * Browser connectivity hint. `navigator.onLine` is only a hint about the
 * local link, never proof of server availability; screens must still surface
 * real request failures through their error/retry states. Server snapshot is
 * `true` so SSR HTML never claims an offline state that hydration cannot
 * reproduce.
 */

function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}
