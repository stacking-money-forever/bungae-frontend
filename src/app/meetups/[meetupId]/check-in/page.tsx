"use client";

import { ChevronRight, KeyRound } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";

type CheckInMethod = "code" | "location";

export default function CheckInPage() {
  const { meetupId } = useParams<{ meetupId: string }>();
  const router = useRouter();
  const encodedMeetupId = encodeURIComponent(meetupId ?? "han-river-walk");
  const hubPath = `/meetups/${encodedMeetupId}/hub?checkin=1`;
  const [method, setMethod] = useState<CheckInMethod>("code");
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  function completeCheckIn() {
    if (isCheckingIn) return;
    setIsCheckingIn(true);
    router.push(`/meetups/${encodedMeetupId}/check-in/success`);
  }

  return (
    <ScreenShell bottomSpacing aria-label="체크인 실행">
      <TopNavigation
        href={hubPath}
        title="체크인"
      />

      <div className="px-[var(--dimension-x5)] pb-8 pt-7">
        <p className="m-0 font-display text-[length:var(--type-time)] leading-6 text-[var(--fg-neutral)]">체크인 가능 · 오후 6:30–7:30</p>
        <h2
          className="m-0 mt-6 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]"
          id="check-in-title"
        >
          현장에 도착했나요?
        </h2>
        <p className="m-0 mt-6 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
          모임 코드 또는 현재 위치로 체크인할 수 있어요. 체크인은 실제 출석 확인에만 사용돼요.
        </p>

        <fieldset className="m-0 mt-7 border-0 p-0" aria-describedby="check-in-method-help">
          <legend className="sr-only">체크인 방법 선택</legend>

          <label
            className={`flex min-h-[148px] cursor-pointer items-center gap-3 rounded-[12px] px-4 py-4 focus-within:outline-2 focus-within:outline-[var(--fg-neutral)] focus-within:outline-offset-2 ${
              method === "code" ? "bg-[var(--bg-neutral-weak)]" : "border border-[var(--stroke-neutral)]"
            }`}
          >
            <input
              className="sr-only"
              type="radio"
              name="check-in-method"
              value="code"
              checked={method === "code"}
              onChange={() => setMethod("code")}
            />
            <span
              className={`flex size-[44px] shrink-0 items-center justify-center rounded-full border-2 ${
                method === "code" ? "border-[var(--fg-neutral)]" : "border-[var(--fg-muted)]"
              }`}
              aria-hidden="true"
            >
              <span
                className={`size-[24px] rounded-full ${
                  method === "code" ? "bg-[var(--fg-neutral)]" : "bg-transparent"
                }`}
              />
            </span>
            <span className="min-w-0">
              <span className="block text-[length:var(--type-section)] font-bold leading-6 text-[var(--fg-neutral)]">모임 코드 입력</span>
              <span className="mt-2 block font-display text-[length:var(--type-headline)] leading-8 text-[var(--fg-neutral)]">MANGO 27</span>
            </span>
          </label>

          <label
            className={`mt-3 flex min-h-[78px] cursor-pointer items-center gap-3 border-b border-[var(--stroke-neutral)] pb-3 focus-within:outline-2 focus-within:outline-[var(--fg-neutral)] focus-within:outline-offset-2 ${
              method === "location" ? "text-[var(--fg-neutral)]" : "text-[var(--fg-muted)]"
            }`}
          >
            <input
              className="sr-only"
              type="radio"
              name="check-in-method"
              value="location"
              checked={method === "location"}
              onChange={() => setMethod("location")}
            />
            <span
              className={`flex size-[44px] shrink-0 items-center justify-center rounded-full border-2 ${
                method === "location" ? "border-[var(--fg-neutral)]" : "border-[var(--fg-muted)]"
              }`}
              aria-hidden="true"
            >
              <span
                className={`size-[24px] rounded-full ${
                  method === "location" ? "bg-[var(--fg-neutral)]" : "bg-transparent"
                }`}
              />
            </span>
            <span className="min-w-0">
              <span className="block text-[length:var(--type-section)] font-bold leading-6">현재 위치로 확인</span>
              <span className="block text-[length:var(--type-body)] leading-[22px]">이 순간의 위치만 확인하고 생활 위치는 저장하지 않아요</span>
            </span>
          </label>
        </fieldset>

        <p
          className="m-0 flex min-h-[72px] items-center gap-3 border-b border-[var(--stroke-neutral)] text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]"
          id="check-in-method-help"
        >
          <KeyRound className="shrink-0" size={28} strokeWidth={1.8} aria-hidden="true" />
          위치 권한이 없어도 위 코드로 체크인할 수 있어요.
        </p>

        <Link
          className="flex min-h-[56px] items-center justify-between gap-3 border-b border-[var(--stroke-neutral)] text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-critical)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
          href={`/meetups/${encodedMeetupId}/safety-cancel`}
        >
          <span>도착했지만 안전이 걱정돼요</span>
          <ChevronRight className="shrink-0" size={24} strokeWidth={1.8} aria-hidden="true" />
        </Link>
      </div>

      <BottomActionBar>
        <button
          className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={completeCheckIn}
          disabled={isCheckingIn}
        >
          {isCheckingIn ? "체크인 확인 중…" : method === "code" ? "코드로 체크인하기" : "위치로 체크인하기"}
        </button>
      </BottomActionBar>
    </ScreenShell>
  );
}
