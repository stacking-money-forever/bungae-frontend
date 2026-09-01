import Link from "next/link";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { ResultSection } from "@/components/result-section";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";

interface JoinResultPageProps {
  params: Promise<{ meetupId: string }>;
}

const joinedDetails = [
  { label: "현재 인원", value: "2명 · 최소 3명" },
  { label: "확정 마감", value: "오늘 오후 5:30" },
  { label: "정확한 장소", value: "확정 후 공개" },
  { label: "그룹 채팅", value: "확정 후 열림" },
];

export default async function JoinResultPage({ params }: JoinResultPageProps) {
  const { meetupId } = await params;
  const encodedMeetupId = encodeURIComponent(meetupId);

  return (
    <ScreenShell bottomSpacing aria-label="참여 완료">
      <TopNavigation
        href={`/meetups/${encodedMeetupId}`}
        title="한강 산책"
      />

      <ResultSection
        className="px-[var(--dimension-x5)] pb-8 pt-12"
        tone="positive"
        heading="퇴근 후 한강 산책에 참여했어요"
        description="한 명 더 모이면 오늘 만나요. 오늘 오후 5:30에 확정돼요."
      >
        <dl className="rounded-[12px] bg-[var(--bg-neutral-weak)] px-4 py-3">
          {joinedDetails.map((detail) => (
            <div
              className="grid min-h-[52px] grid-cols-[96px_minmax(0,1fr)] items-center gap-3"
              key={detail.label}
            >
              <dt className="text-[length:var(--type-body)] leading-5 text-[var(--fg-muted)]">{detail.label}</dt>
              <dd
                className={`m-0 text-right text-[var(--fg-neutral)] ${
                  detail.label === "확정 마감"
                    ? "font-display text-[length:var(--type-time)] font-normal leading-6"
                    : "text-[length:var(--type-title)] font-semibold leading-5"
                }`}
              >
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="m-0 mt-4 text-[length:var(--type-section)] font-semibold leading-6 text-[var(--fg-neutral)]">
          오후 5:30 전에 취소하면 출석 기록에 남지 않아요.
        </p>
      </ResultSection>

      <BottomActionBar>
        <Link
          className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
          href="/my-meetups"
        >
          내 모임에서 확인하기
        </Link>
      </BottomActionBar>
    </ScreenShell>
  );
}
