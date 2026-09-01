"use client";

import { ChevronRight, CircleCheck, ShieldAlert } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { ResultSection } from "@/components/result-section";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";

export default function SafetyCancelPage() {
  const params = useParams<{ meetupId: string }>();
  const meetupId = typeof params.meetupId === "string" ? params.meetupId : "han-river-walk";
  const meetupHref = `/meetups/${encodeURIComponent(meetupId)}`;
  const [helpOpen, setHelpOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <ScreenShell bottomSpacing>
      <TopNavigation
        href={meetupHref}
        title={<span className="font-display text-[length:var(--type-page-title)] font-normal leading-6">모임 취소 안내</span>}
      />

      {acknowledged ? (
        <div className="flex flex-1 flex-col px-5 pb-8">
          <ResultSection
            className="mt-14 px-0"
            tone="critical"
            heading="취소 접수됐어요"
            description="안전 사유로 모임 취소를 접수했어요. 신고자와 상세 사유는 공개하지 않아요."
          >
            <div className="border-t border-[var(--stroke-neutral)] pt-4 text-center text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
              <p className="m-0">접수와 처리 상태는 알림으로 안내해요.</p>
              <p className="m-0 mt-1">이 화면은 접수 확인이며 처리 결과를 뜻하지 않아요.</p>
            </div>
          </ResultSection>
        </div>
      ) : (
        <div className="flex flex-1 flex-col px-5 pb-8">
          <section className="mt-16 flex flex-col items-center text-center" aria-labelledby="safety-cancel-heading" role="alert">
            <div className="flex size-[72px] items-center justify-center rounded-full bg-[var(--bg-critical-weak)] text-[var(--fg-critical)]" aria-hidden="true">
              <ShieldAlert size={34} strokeWidth={1.8} />
            </div>
            <h2 id="safety-cancel-heading" className="mt-5 font-display text-[length:var(--type-headline)] font-normal leading-8 tracking-[-0.03em]">
              안전을 위해 모임을 취소했어요
            </h2>
            <p className="mt-4 max-w-[345px] text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
              참가자의 안전을 보호하기 위해 더 이상 모임을 진행하지 않아요. 신고자나 상세 사유는 공개하지 않아요.
            </p>
          </section>

          <aside className="mt-6 flex items-start gap-3 rounded-2xl bg-[var(--bg-neutral-weak)] px-4 py-4" aria-label="취소 영향 안내">
            <CircleCheck className="mt-0.5 shrink-0 text-[var(--fg-muted)]" size={25} strokeWidth={1.8} aria-hidden="true" />
            <p className="m-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)]">이번 취소는 출석 신뢰와 참여 기록에 반영되지 않아요.</p>
          </aside>

          <section className="mt-7 border-t border-[var(--stroke-neutral)] pt-5" aria-labelledby="help-heading">
            <h3 id="help-heading" className="m-0 text-[length:var(--type-section)] font-semibold leading-6 text-[var(--fg-neutral)]">지금 도움이 필요한가요?</h3>
            <button
              className="mt-4 flex min-h-[56px] w-full items-center justify-between border-b border-[var(--stroke-neutral)] py-3 text-left text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-critical)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              type="button"
              aria-expanded={helpOpen}
              onClick={() => setHelpOpen((current) => !current)}
            >
              <span>긴급 도움과 안전 가이드 보기</span>
              <ChevronRight className={`shrink-0 transition-transform ${helpOpen ? "rotate-90" : ""}`} size={24} strokeWidth={1.8} aria-hidden="true" />
            </button>
            {helpOpen ? (
              <div className="border-b border-[var(--stroke-neutral)] bg-[var(--bg-critical-weak)] px-4 py-4" role="region" aria-label="긴급 도움 안내">
                <p className="m-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)]">지금 위험하다면 주변의 도움을 요청하고 아래 긴급전화로 연락하세요.</p>
                <div className="mt-3 flex gap-3">
                  <a className="inline-flex min-h-[44px] items-center border border-[var(--fg-critical)] px-3 text-[16px] font-semibold leading-6 text-[var(--fg-critical)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2" href="tel:112">112 경찰</a>
                  <a className="inline-flex min-h-[44px] items-center border border-[var(--fg-critical)] px-3 text-[16px] font-semibold leading-6 text-[var(--fg-critical)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2" href="tel:119">119 응급</a>
                </div>
              </div>
            ) : null}
            <p className="m-0 mt-4 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">접수와 처리 상태는 알림으로 안내해요. 접수는 해결 완료를 뜻하지 않아요.</p>
          </section>
        </div>
      )}

      <BottomActionBar>
        <button
          className="flex min-h-[52px] w-full items-center justify-center bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
          type="button"
          onClick={() => setAcknowledged(true)}
        >
          {acknowledged ? "확인했어요" : "확인했어요"}
        </button>
      </BottomActionBar>
    </ScreenShell>
  );
}
