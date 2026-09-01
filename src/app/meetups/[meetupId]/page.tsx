import {
  ChevronRight,
  CircleCheck,
  LockKeyhole,
  MapPin,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";

interface MeetupDetailPageProps {
  params: Promise<{ meetupId: string }>;
}

const meetupDetails = [
  { label: "시간", value: "오늘 18:30–20:00" },
  { label: "인원", value: "현재 2명 · 최소 3명 · 정원 6명" },
  { label: "비용", value: "무료" },
  { label: "음주", value: "없음" },
  { label: "진행", value: "20분 산책 후 카페 선택" },
];

export default async function MeetupDetailPage({ params }: MeetupDetailPageProps) {
  const { meetupId } = await params;
  const encodedMeetupId = encodeURIComponent(meetupId);

  return (
    <ScreenShell bottomSpacing aria-label="모임 상세">
      <TopNavigation
        href="/"
        title="모임 상세"
      />

      <div className="px-[var(--dimension-x5)] pb-8 pt-7">
        <section aria-labelledby="meetup-title">
          <h2
            id="meetup-title"
            className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]"
          >
            퇴근 후 한강 산책
          </h2>
          <p className="m-0 mt-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
            망원에서 한강 따라 20분 걷고, 카페에서 잠깐 이야기 나눠요.
          </p>
          <p className="m-0 mt-6 font-display text-[20px] font-normal leading-7 text-[var(--fg-neutral)]">
            한 명 더 참여하면 모임이 확정돼요.
          </p>
        </section>

        <dl className="mt-6 border-y border-[var(--stroke-neutral)]">
          {meetupDetails.map((detail) => (
            <div
              className="grid min-h-[46px] grid-cols-[52px_minmax(0,1fr)] items-center gap-3 border-b border-[var(--stroke-neutral)] last:border-b-0"
              key={detail.label}
            >
              <dt className="text-[length:var(--type-body)] leading-5 text-[var(--fg-muted)]">{detail.label}</dt>
              <dd
                className={`m-0 text-right text-[var(--fg-neutral)] ${
                  detail.label === "시간"
                    ? "font-display text-[length:var(--type-time)] font-normal leading-6"
                    : "text-[length:var(--type-title)] font-semibold leading-5"
                }`}
              >
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-3 flex items-start gap-3 rounded-[12px] bg-[var(--bg-neutral-weak)] px-4 py-3">
          <LockKeyhole
            className="mt-0.5 shrink-0 text-[var(--fg-muted)]"
            size={28}
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="m-0 text-[length:var(--type-title)] font-bold leading-5">마포구 망원동</p>
            <p className="m-0 mt-1 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
              정확한 장소는 참여 확정 후 공개해요.
            </p>
          </div>
        </div>

        <ul className="m-0 mt-3 list-none divide-y divide-[var(--stroke-neutral)] p-0">
          <li className="flex min-h-[42px] items-center gap-3">
            <CircleCheck
              className="shrink-0 text-[var(--fg-neutral)]"
              size={24}
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span className="text-[length:var(--type-section)] font-semibold leading-6">참가자 본인 인증 100%</span>
          </li>
          <li className="flex min-h-[42px] items-center gap-3">
            <MapPin
              className="shrink-0 text-[var(--fg-neutral)]"
              size={24}
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span className="text-[length:var(--type-section)] font-semibold leading-6">공개 장소에서 만나요</span>
          </li>
          <li className="flex min-h-[42px] items-center gap-3">
            <UsersRound
              className="shrink-0 text-[var(--fg-neutral)]"
              size={24}
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <span className="text-[length:var(--type-section)] font-semibold leading-6">
              평점 없이 본인 인증으로 만나요
            </span>
          </li>
        </ul>

        <details className="group border-t border-[var(--stroke-neutral)]">
          <summary className="flex min-h-[46px] cursor-pointer list-none items-center justify-between gap-3 text-[length:var(--type-action)] font-semibold leading-6 marker:hidden focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2">
            <span>모임 또는 사용자를 신고·차단하기</span>
            <ChevronRight
              className="shrink-0 text-[var(--fg-muted)] transition-transform group-open:rotate-90"
              size={24}
              strokeWidth={1.8}
              aria-hidden="true"
            />
          </summary>
          <div className="pb-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
            불편하거나 위험한 상황은 안전 도움을 통해 알려주세요. 차단하면 이후 같은 모임에
            서로 노출되지 않아요.
          </div>
        </details>

      </div>

      <BottomActionBar>
        <Link
          className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
          href={`/meetups/${encodedMeetupId}/join`}
        >
          이 모임에 참여하기
        </Link>
      </BottomActionBar>
    </ScreenShell>
  );
}
