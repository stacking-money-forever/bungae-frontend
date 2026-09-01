"use client";

import { MapPin } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { ResultSection } from "@/components/result-section";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";

export default function CheckInSuccessPage() {
  const { meetupId } = useParams<{ meetupId: string }>();
  const encodedMeetupId = encodeURIComponent(meetupId ?? "han-river-walk");
  const hubPath = `/meetups/${encodedMeetupId}/hub?checkin=1`;

  return (
    <ScreenShell bottomSpacing aria-label="체크인 성공">
      <TopNavigation
        href={hubPath}
        title="체크인"
      />

      <ResultSection
        className="px-[var(--dimension-x5)] pb-8 pt-12"
        tone="positive"
        heading="체크인했어요"
        description="참가자들과 인사를 나누고 첫 10분 가이드를 시작해 보세요."
      >
        <div className="flex min-h-[112px] items-center gap-3 rounded-[12px] bg-[var(--bg-neutral-weak)] px-4 py-4 text-[var(--fg-neutral)]">
          <MapPin className="shrink-0" size={28} strokeWidth={1.8} aria-hidden="true" />
          <div className="min-w-0">
            <p className="m-0 text-[length:var(--type-title)] font-bold leading-5">퇴근 후 한강 산책</p>
            <p className="m-0 mt-1 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">망원한강공원 3번 출입구</p>
          </div>
        </div>
      </ResultSection>

      <BottomActionBar>
        <Link
          className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
          href={`/meetups/${encodedMeetupId}/chat#guide`}
        >
          첫 10분 가이드 보기
        </Link>
      </BottomActionBar>
    </ScreenShell>
  );
}
