"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { OfflineNotice } from "@/components/offline-notice";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";
import { ApiProblemError } from "@/lib/api/client";
import type { NoShowAppeal } from "@/lib/api/types";
import { useOptionalAuthSession } from "@/lib/auth/auth-session-provider";
import { SessionExpiredError } from "@/lib/auth/session-store";

function errorMessage(error: unknown): string {
  return error instanceof ApiProblemError ? error.problem?.detail ?? "이의 목록을 불러오지 못했어요. 다시 시도해 주세요." : "이의 목록을 불러오지 못했어요. 다시 시도해 주세요.";
}

export default function NoShowAppealsPage() {
  const auth = useOptionalAuthSession();
  const subject = auth?.snapshot.status === "authenticated" ? auth.snapshot.user.id : null;
  const sessionEpoch = auth?.sessionEpoch ?? 0;
  // Session-scoped key: same subject re-login is a fresh session.
  const sessionKey = subject ? `${sessionEpoch}:${subject}` : null;
  const sessionKeyRef = useRef(sessionKey);
  sessionKeyRef.current = sessionKey;
  const requestRef = useRef(0);
  const [items, setItems] = useState<NoShowAppeal[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!auth || !sessionKey) return;
    const request = ++requestRef.current;
    setState("loading"); setError(null);
    try {
      const next = await auth.listNoShowAppeals();
      if (requestRef.current !== request || sessionKeyRef.current !== sessionKey) return;
      setItems(next); setState("ready");
    } catch (nextError) {
      if (requestRef.current !== request || sessionKeyRef.current !== sessionKey || nextError instanceof SessionExpiredError) return;
      setItems([]); setState("error"); setError(errorMessage(nextError));
    }
  }, [auth, sessionKey]);
  useEffect(() => { requestRef.current += 1; setItems([]); setState("idle"); setError(null); if (sessionKey) void load(); return () => { requestRef.current += 1; }; }, [load, sessionKey]);
  if (!subject || !auth) return <ScreenShell className="px-5 pb-8" aria-label="로그인 필요"><TopNavigation href="/profile" title="노쇼 이의" /><p className="pt-12 text-[14px] text-[var(--fg-muted)]">로그인 후 내 이의를 확인할 수 있어요.</p></ScreenShell>;
  return <ScreenShell className="px-5 pb-8"><TopNavigation href="/profile" title="노쇼 이의" /><main className="pt-6" aria-labelledby="appeals-heading"><h1 id="appeals-heading" className="m-0 text-[18px] font-bold text-[var(--fg-neutral)]">내 노쇼 이의</h1><OfflineNotice className="mt-4" />{state === "loading" ? <p role="status" className="mt-5 text-[14px] text-[var(--fg-muted)]">이의 목록을 불러오는 중이에요.</p> : null}{state === "error" ? <section className="mt-5 grid gap-3" role="alert"><p className="m-0 text-[14px] text-[var(--fg-neutral)]">{error}</p><button type="button" onClick={() => void load()} className="min-h-[44px] border border-[var(--stroke-neutral)]">다시 불러오기</button></section> : null}{state === "ready" && !items.length ? <p className="mt-5 text-[14px] text-[var(--fg-muted)]">제출한 노쇼 이의가 없어요.</p> : null}{state === "ready" && items.length ? <ul className="m-0 mt-5 grid list-none gap-3 p-0">{items.map((appeal) => <li key={appeal.id}><Link href={`/profile/no-show-appeals/${encodeURIComponent(appeal.id)}`} className="block rounded-2xl border border-[var(--stroke-neutral)] p-4"><strong className="text-[15px] text-[var(--fg-neutral)]">{appeal.state}</strong><span className="mt-2 block break-all text-[13px] text-[var(--fg-muted)]">기한: {appeal.deadlineAt}</span><span className="mt-1 block break-all text-[13px] text-[var(--fg-muted)]">접수: {appeal.submittedAt}</span></Link></li>)}</ul> : null}</main></ScreenShell>;
}
