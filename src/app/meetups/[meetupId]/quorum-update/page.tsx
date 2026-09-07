"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";

export default function QuorumUpdatePage() {
  const { meetupId } = useParams<{ meetupId: string }>();
  const encodedMeetupId = encodeURIComponent(meetupId ?? "");
  const meetupPath = `/meetups/${encodedMeetupId}`;

  return (
    <ScreenShell bottomSpacing aria-label="모임 상태 확인 필요">
      <TopNavigation href={meetupPath} title="모임 상태 확인" />
      <section className="px-[var(--dimension-x5)] pb-8 pt-12" aria-labelledby="quorum-update-contract-gap-heading">
        <h2 id="quorum-update-contract-gap-heading" className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">
          최신 모임 상태를 확인해 주세요
        </h2>
        <p className="m-0 mt-4 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
          이 화면은 취소나 진행 완료를 직접 표시하지 않아요. 모임 상세에서 최신 allowedActions를 확인한 뒤 실제 참여 취소 또는 인원 결정을 진행해 주세요.
        </p>
      </section>
      <BottomActionBar>
        <Link
          className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
          href={meetupPath}
        >
          모임 상세에서 최신 상태 확인하기
        </Link>
      </BottomActionBar>
    </ScreenShell>
  );
}
