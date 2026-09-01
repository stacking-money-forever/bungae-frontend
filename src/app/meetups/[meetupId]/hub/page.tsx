"use client";

import { ChevronRight, ListChecks, MapPin, MessageCircle, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";

const hubActions = [
  {
    label: "그룹 채팅",
    description: "확정 참가자만 참여해요",
    icon: MessageCircle,
    destination: "chat",
  },
  {
    label: "첫 10분 진행 가이드",
    description: "소개 순서 · 활동 규칙 · 종료 시각",
    icon: ListChecks,
    destination: "guide",
  },
  {
    label: "안전·신고·차단",
    description: "지금 바로 신고하거나 차단할 수 있어요",
    icon: ShieldAlert,
    destination: "safety",
  },
] as const;

export default function MeetupHubPage() {
  const { meetupId } = useParams<{ meetupId: string }>();
  const encodedMeetupId = encodeURIComponent(meetupId ?? "han-river-walk");
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);

  useEffect(() => {
    setIsCheckInOpen(new URLSearchParams(window.location.search).get("checkin") === "1");
  }, []);

  return (
    <ScreenShell bottomSpacing aria-label="확정 모임 허브">
      <TopNavigation
        href="/"
        title="확정 모임"
      />

      <div className="px-[var(--dimension-x5)] pb-8 pt-7">
        <section aria-labelledby="hub-title">
          <h2
            id="hub-title"
            className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]"
          >
            퇴근 후 한강 산책
          </h2>
          <p className="m-0 mt-4 font-display text-[length:var(--type-time)] leading-6 text-[var(--fg-neutral)]">
            오늘 오후 6:30 · 체크인 시작까지 42분 남음
          </p>
        </section>

        <section className="mt-7" aria-labelledby="location-title">
          <h3 id="location-title" className="sr-only">
            확정된 장소
          </h3>
          <div
            className="relative h-[128px] overflow-hidden rounded-t-[12px] bg-[var(--stroke-neutral)]"
            role="img"
            aria-label="망원한강공원 주변 약도"
          >
            <span className="absolute left-[-12%] top-[42%] h-px w-[124%] rotate-[8deg] bg-[var(--stroke-neutral)]" aria-hidden="true" />
            <span className="absolute left-[-8%] top-[66%] h-px w-[118%] rotate-[-11deg] bg-[var(--stroke-neutral)]" aria-hidden="true" />
            <span className="absolute left-[24%] top-[-16%] h-[148%] w-px rotate-[24deg] bg-[var(--stroke-neutral)]" aria-hidden="true" />
            <span className="absolute left-[69%] top-[-12%] h-[144%] w-px rotate-[-18deg] bg-[var(--stroke-neutral)]" aria-hidden="true" />
            <span className="absolute left-1/2 top-1/2 flex size-[42px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[10px] bg-[var(--brand-accent)] text-[var(--fg-on-brand)]" aria-hidden="true">
              <MapPin size={24} strokeWidth={1.9} />
            </span>
          </div>
          <div className="flex min-h-[94px] items-center gap-3 rounded-b-[12px] bg-[var(--bg-neutral-weak)] px-4 py-3">
            <MapPin className="shrink-0 text-[var(--fg-neutral)]" size={28} strokeWidth={1.8} aria-hidden="true" />
            <div className="min-w-0">
              <p className="m-0 text-[length:var(--type-title)] font-bold leading-5 text-[var(--fg-neutral)]">망원한강공원 3번 출입구</p>
              <p className="m-0 mt-1 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">서울 마포구 마포나루길 467</p>
            </div>
          </div>
        </section>

        <nav className="mt-6" aria-label="확정 모임 메뉴">
          {hubActions.map(({ label, description, icon: Icon, destination }) => {
            const href =
              destination === "safety"
                ? `/meetups/${encodedMeetupId}/safety-cancel`
                : `/meetups/${encodedMeetupId}/chat${destination === "guide" ? "#guide" : ""}`;

            return (
              <Link
                className="flex min-h-[78px] items-center gap-3 border-b border-[var(--stroke-neutral)] py-3 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                href={href}
                key={label}
              >
                <Icon className="shrink-0 text-[var(--fg-neutral)]" size={28} strokeWidth={1.8} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[length:var(--type-section)] font-bold leading-6 text-[var(--fg-neutral)]">{label}</span>
                  <span className="block text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">{description}</span>
                </span>
                <ChevronRight className="shrink-0 text-[var(--fg-muted)]" size={24} strokeWidth={1.8} aria-hidden="true" />
              </Link>
            );
          })}
        </nav>
      </div>

      <BottomActionBar>
        <Link
          className={`inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] px-4 text-[length:var(--type-action)] font-bold leading-6 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2 ${
            isCheckInOpen
              ? "bg-[var(--brand-accent)] text-[var(--fg-on-brand)]"
              : "bg-[var(--bg-layer-floating)] text-[var(--fg-muted)] ring-1 ring-inset ring-[var(--stroke-neutral)]"
          }`}
          href={`/meetups/${encodedMeetupId}/check-in`}
          aria-disabled={!isCheckInOpen}
          onClick={(event) => {
            if (!isCheckInOpen) {
              event.preventDefault();
            }
          }}
        >
          {isCheckInOpen ? "체크인하기" : "체크인 시작 후 이용 가능"}
        </Link>
      </BottomActionBar>
    </ScreenShell>
  );
}
