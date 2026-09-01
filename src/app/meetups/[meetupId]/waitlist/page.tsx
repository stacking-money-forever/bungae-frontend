import { Bell, CircleX, Clock3, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";

interface WaitlistResultPageProps {
  params: Promise<{ meetupId: string }>;
}

const waitlistNotes = [
  {
    label: "참여가 확정되면 즉시 알려드려요",
    icon: Bell,
  },
  {
    label: "모든 대기는 등록 순서대로 처리돼요",
    icon: ShieldCheck,
  },
  {
    label: "언제든 대기를 취소할 수 있어요",
    icon: CircleX,
  },
];

export default async function WaitlistResultPage({ params }: WaitlistResultPageProps) {
  const { meetupId } = await params;
  const encodedMeetupId = encodeURIComponent(meetupId);

  return (
    <ScreenShell bottomSpacing aria-label="대기 등록 결과">
      <TopNavigation
        href={`/meetups/${encodedMeetupId}`}
        title="대기 등록됨"
      />

      <section
        className="flex flex-col items-center gap-4 px-[var(--dimension-x5)] pb-8 pt-12"
        aria-labelledby="waitlist-heading"
      >
        <div
          className="flex size-[72px] items-center justify-center rounded-full bg-[var(--bg-neutral-weak)] text-[var(--fg-neutral)]"
          aria-hidden="true"
        >
          <Clock3 size={32} strokeWidth={1.8} />
        </div>
        <h2
          id="waitlist-heading"
          className="m-0 w-full text-center font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]"
        >
          대기 순서에 등록됐어요
        </h2>
        <p className="m-0 w-full text-center text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
          자리가 나면 등록 순서에 따라 자동으로 참여 확정 알림을
          <br className="hidden min-[360px]:block" />
          보내드려요.
        </p>

        <ul className="m-0 mt-2 w-full list-none rounded-[12px] bg-[var(--bg-neutral-weak)] px-4 py-3">
          {waitlistNotes.map(({ label, icon: Icon }) => (
            <li className="flex min-h-[52px] items-center gap-3" key={label}>
              <Icon
                className="shrink-0 text-[var(--fg-muted)]"
                size={24}
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span className="text-[length:var(--type-section)] font-semibold leading-6">{label}</span>
            </li>
          ))}
        </ul>
      </section>

      <BottomActionBar>
        <Link
          className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
          href={`/meetups/${encodedMeetupId}`}
        >
          모임 상세 보기
        </Link>
        <Link
          className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--bg-layer-floating)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
          href="/"
        >
          대기 취소하기
        </Link>
      </BottomActionBar>
    </ScreenShell>
  );
}
