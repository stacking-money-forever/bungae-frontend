"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { OfflineNotice } from "@/components/offline-notice";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";
import { ApiProblemError } from "@/lib/api/client";
import type { NoShowAppeal } from "@/lib/api/types";
import { useOptionalAuthSession } from "@/lib/auth/auth-session-provider";
import { SessionExpiredError } from "@/lib/auth/session-store";

function errorMessage(error: unknown): string { return error instanceof ApiProblemError ? error.problem?.detail ?? "이의 상세를 불러오지 못했어요. 다시 시도해 주세요." : "이의 상세를 불러오지 못했어요. 다시 시도해 주세요."; }

export default function NoShowAppealDetailPage() {
  const { appealId = "" } = useParams<{ appealId: string }>();
  const auth = useOptionalAuthSession();
  const subject = auth?.snapshot.status === "authenticated" ? auth.snapshot.user.id : null;
  const sessionEpoch = auth?.sessionEpoch ?? 0;
  // Route + session identity: same subject re-login or a changed appeal must
  // never render the previous route/account completion.
  const identity = subject ? `${sessionEpoch}:${subject}:${appealId}` : `anonymous:${appealId}`;
  const identityRef = useRef(identity); identityRef.current = identity;
  const requestRef = useRef(0);
  const [appeal, setAppeal] = useState<NoShowAppeal | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { if (!auth || !subject || !appealId || !identity) return; const request = ++requestRef.current; const requestedIdentity = identity; setState("loading"); setError(null); try { const next = await auth.getNoShowAppeal(appealId); if (requestRef.current !== request || identityRef.current !== requestedIdentity) return; setAppeal(next); setState("ready"); } catch (nextError) { if (requestRef.current !== request || identityRef.current !== requestedIdentity || nextError instanceof SessionExpiredError) return; setAppeal(null); setState("error"); setError(errorMessage(nextError)); } }, [appealId, auth, identity, subject]);
  useEffect(() => { requestRef.current += 1; setAppeal(null); setState("idle"); setError(null); if (subject && appealId && identity) void load(); return () => { requestRef.current += 1; }; }, [appealId, identity, load, subject]);
  if (!subject || !auth) return <ScreenShell className="px-5 pb-8" aria-label="로그인 필요"><TopNavigation href="/profile/no-show-appeals" title="이의 상세" /><p className="pt-12 text-[14px] text-[var(--fg-muted)]">로그인 후 이의 상세를 확인할 수 있어요.</p></ScreenShell>;
  return <ScreenShell className="px-5 pb-8"><TopNavigation href="/profile/no-show-appeals" title="이의 상세" /><main className="pt-6" aria-labelledby="appeal-detail-heading"><h1 id="appeal-detail-heading" className="m-0 text-[18px] font-bold text-[var(--fg-neutral)]">노쇼 이의 상세</h1><OfflineNotice className="mt-4" />{state === "loading" ? <p role="status" className="mt-5 text-[14px] text-[var(--fg-muted)]">이의 상세를 불러오는 중이에요.</p> : null}{state === "error" ? <section className="mt-5 grid gap-3" role="alert"><p className="m-0 text-[14px] text-[var(--fg-neutral)]">{error}</p><button type="button" onClick={() => void load()} className="min-h-[44px] border border-[var(--stroke-neutral)]">다시 불러오기</button></section> : null}{state === "ready" && appeal ? <dl className="mt-5 grid gap-4 rounded-2xl border border-[var(--stroke-neutral)] p-4 text-[14px] text-[var(--fg-neutral)]"><div><dt className="text-[var(--fg-muted)]">상태</dt><dd className="m-0 mt-1">{appeal.state}</dd></div><div><dt className="text-[var(--fg-muted)]">접수 시각</dt><dd className="m-0 mt-1 break-all">{appeal.submittedAt}</dd></div><div><dt className="text-[var(--fg-muted)]">기한</dt><dd className="m-0 mt-1 break-all">{appeal.deadlineAt}</dd></div><div><dt className="text-[var(--fg-muted)]">이의 사유</dt><dd className="m-0 mt-1 whitespace-pre-wrap">{appeal.reason}</dd></div>{appeal.resolution ? <div><dt className="text-[var(--fg-muted)]">처리 결과</dt><dd className="m-0 mt-1 whitespace-pre-wrap">{appeal.resolution}</dd></div> : null}{appeal.reviewedAt ? <div><dt className="text-[var(--fg-muted)]">처리 시각</dt><dd className="m-0 mt-1 break-all">{appeal.reviewedAt}</dd></div> : null}</dl> : null}</main></ScreenShell>;
}
