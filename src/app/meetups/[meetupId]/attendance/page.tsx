"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { OfflineNotice } from "@/components/offline-notice";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";
import { ApiProblemError } from "@/lib/api/client";
import type { NoShowAppeal } from "@/lib/api/types";
import { useOptionalAuthSession } from "@/lib/auth/auth-session-provider";
import { SessionExpiredError } from "@/lib/auth/session-store";
import { useOnlineStatus } from "@/lib/ui/online";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiProblemError ? error.problem?.detail ?? fallback : fallback;
}

export default function AttendancePage() {
  const { meetupId = "" } = useParams<{ meetupId: string }>();
  const auth = useOptionalAuthSession();
  const subject = auth?.snapshot.status === "authenticated" ? auth.snapshot.user.id : null;
  // Session-scoped identity: the same subject logging in again after logout is
  // a distinct UI session, so a late appeal completion cannot render a receipt.
  const sessionEpoch = auth?.sessionEpoch ?? 0;
  const identity = `${sessionEpoch}:${subject ?? "anonymous"}:${meetupId}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const inFlight = useRef<Promise<NoShowAppeal> | null>(null);
  const receiptRef = useRef<HTMLParagraphElement>(null);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<NoShowAppeal | null>(null);
  const encodedMeetupId = encodeURIComponent(meetupId);
  const meetupPath = `/meetups/${encodedMeetupId}`;
  const online = useOnlineStatus();

  useEffect(() => {
    inFlight.current = null;
    setReason("");
    setPending(false);
    setError(null);
    setReceipt(null);
  }, [identity]);

  useEffect(() => {
    if (receipt) receiptRef.current?.focus();
  }, [receipt]);

  const submit = async () => {
    const trimmedReason = reason.trim();
    if (!subject || !auth || !meetupId || pending || inFlight.current || !online) return;
    if (!trimmedReason) {
      setError("이의 사유를 입력해 주세요.");
      return;
    }
    if (trimmedReason.length > 2000) {
      setError("이의 사유는 2,000자 이하여야 해요.");
      return;
    }
    const requestedIdentity = identity;
    setPending(true);
    setError(null);
    setReceipt(null);
    const request = auth.createNoShowAppeal(meetupId, { reason: trimmedReason });
    inFlight.current = request;
    try {
      const appeal = await request;
      if (identityRef.current !== requestedIdentity) return;
      setReceipt(appeal);
    } catch (nextError) {
      if (identityRef.current !== requestedIdentity || nextError instanceof SessionExpiredError) return;
      setError(errorMessage(nextError, "이의 접수를 완료하지 못했어요. 다시 시도해 주세요."));
    } finally {
      if (inFlight.current === request) inFlight.current = null;
      if (identityRef.current === requestedIdentity) setPending(false);
    }
  };

  if (!subject || !auth) {
    return <ScreenShell className="px-5 pb-8" aria-label="로그인 필요"><TopNavigation href={meetupPath} title="출석 기록" /><section className="pt-12"><h1 className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">로그인한 계정에서만 이의를 접수할 수 있어요</h1><p className="m-0 mt-4 text-[14px] leading-5 text-[var(--fg-muted)]">이의 가능 여부는 서버의 출석 기록을 기준으로 확인해요.</p></section></ScreenShell>;
  }

  return (
    <ScreenShell bottomSpacing aria-label="노쇼 이의 접수">
      <TopNavigation href={meetupPath} title="출석 이의" />
      <div className="px-[var(--dimension-x5)] pb-8 pt-6">
        <h1 id="appeal-heading" className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">노쇼 결정 이의 접수</h1>
        <p className="m-0 mt-3 text-[14px] leading-5 text-[var(--fg-muted)]">서버가 노쇼로 결정한 출석 기록에만 접수할 수 있어요. 가능 여부와 기한은 제출 후 서버 응답으로 확인해요.</p>
        <label className="mt-6 grid gap-2 text-[14px] font-bold text-[var(--fg-neutral)]">이의 사유<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} disabled={pending || Boolean(receipt)} className="min-h-36 border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] p-3 text-[16px] font-normal text-[var(--fg-neutral)]" aria-describedby="appeal-reason-help" /></label>
        <p id="appeal-reason-help" className="m-0 mt-2 text-[12px] leading-5 text-[var(--fg-muted)]">증빙 업로드 선택 기능은 아직 제공되지 않아요. 사유만 접수되며, 결과는 내 신고·이의 목록에서 확인할 수 있어요.</p>
        {error ? <section className="mt-4 grid gap-2" role="alert"><p className="m-0 text-[14px] leading-5 text-[var(--fg-neutral)]">{error}</p><button type="button" onClick={() => void submit()} disabled={pending || Boolean(receipt) || !online} className="min-h-[44px] border border-[var(--stroke-neutral)] px-3 text-[14px] font-bold text-[var(--fg-neutral)] disabled:opacity-60">다시 시도</button></section> : null}
        {receipt ? <section className="mt-5 rounded-2xl border border-[var(--stroke-neutral)] p-4" aria-labelledby="appeal-receipt-heading"><h2 id="appeal-receipt-heading" className="m-0 text-[16px] font-bold text-[var(--fg-neutral)]">이의가 접수됐어요</h2><p ref={receiptRef} tabIndex={-1} className="m-0 mt-3 outline-none text-[14px] leading-5 text-[var(--fg-neutral)]" role="status">처리 상태: {receipt.state === "SUBMITTED" ? "접수됨" : receipt.state === "REVIEWING" ? "검토 중" : receipt.state === "ACCEPTED" ? "받아들여짐" : receipt.state === "REJECTED" ? "받아들여지지 않음" : "확인할 수 없음"}</p><dl className="m-0 mt-3 grid gap-2 text-[14px] leading-5 text-[var(--fg-neutral)]"><div><dt className="text-[var(--fg-muted)]">접수 시각</dt><dd className="m-0">{receipt.submittedAt}</dd></div><div><dt className="text-[var(--fg-muted)]">기한</dt><dd className="m-0">{receipt.deadlineAt}</dd></div></dl><Link href="/profile/no-show-appeals" className="mt-4 inline-flex min-h-[44px] items-center font-bold text-[var(--fg-neutral)]">내 이의 확인</Link></section> : null}
      </div>
      <OfflineNotice className="mx-5 mt-5" />
      <BottomActionBar><button type="button" onClick={() => void submit()} disabled={pending || Boolean(receipt) || !reason.trim() || !online} className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] disabled:opacity-60">{pending ? "접수 중" : receipt ? "접수 완료" : "이의 접수"}</button></BottomActionBar>
    </ScreenShell>
  );
}
