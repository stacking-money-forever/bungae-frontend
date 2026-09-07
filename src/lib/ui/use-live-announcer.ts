import { useCallback, useRef, useState } from "react";

import type { LiveRegionKind } from "@/lib/ui/live-region";

/**
 * Announcements with a stable key so a repeated message is not re-read
 * verbatim, and role selection stays explicit (alert vs status). Consumers
 * control timing; this never fabricates content.
 */
export function useLiveAnnouncer() {
  const [announcement, setAnnouncement] = useState<{
    key: string;
    label: string;
    kind: LiveRegionKind;
    nonce: number;
  } | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  const nonceRef = useRef(0);

  const announce = useCallback((key: string, label: string, kind: LiveRegionKind) => {
    if (lastKeyRef.current === key) {
      return;
    }
    lastKeyRef.current = key;
    nonceRef.current += 1;
    setAnnouncement({ key, label, kind, nonce: nonceRef.current });
  }, []);

  const clear = useCallback(() => {
    lastKeyRef.current = null;
    setAnnouncement(null);
  }, []);

  return { announcement, announce, clear };
}
