import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  type LucideIcon,
} from "lucide-react";

type MeetupFixture = {
  title: string;
  dateTime: string;
  dateLabel: string;
  location: string;
  participantState: string;
  meetupState: string;
  currentAction: string;
  transition: string;
  href: string;
  icon: LucideIcon;
  tone: "positive" | "muted";
};

const activeMeetups: MeetupFixture[] = [
  {
    title: "퇴근 후 한강 산책",
    dateTime: "2026-09-01T18:30:00+09:00",
    dateLabel: "오늘 18:30",
    location: "망원한강공원 3번 출입구 · 확정 장소",
    participantState: "내 상태: 참여 중 · 현재 3명 / 정원 6명",
    meetupState: "확정",
    currentAction: "체크인 준비",
    transition: "체크인 시작까지 42분 · 오늘 오후 6:30",
    href: "/meetups/demo/hub",
    icon: CalendarClock,
    tone: "positive",
  },
  {
    title: "상수 카페 대화",
    dateTime: "2026-09-01T19:30:00+09:00",
    dateLabel: "오늘 19:30",
    location: "상수역 인근 · 대략 위치",
    participantState: "내 상태: 대기 중 · 현재 6명 / 정원 6명",
    meetupState: "대기 중",
    currentAction: "자리 발생 시 자동 안내",
    transition: "오늘 오후 7:30까지 자리 발생 시 안내",
    href: "/meetups/sangsu-cafe-chat/waitlist",
    icon: Clock3,
    tone: "muted",
  },
];

const completedMeetups: MeetupFixture[] = [
  {
    title: "합정 보드게임",
    dateTime: "2026-08-31T19:00:00+09:00",
    dateLabel: "어제 19:00",
    location: "합정 보드게임 카페 2층 · 확정 장소",
    participantState: "내 상태: 체크인 완료 · 참가 4명 / 정원 6명",
    meetupState: "완료",
    currentAction: "비공개 피드백 남기기",
    transition: "피드백 마감까지 2일",
    href: "/meetups/hapjeong-board-games/feedback",
    icon: CheckCircle2,
    tone: "muted",
  },
];

const toneClasses: Record<MeetupFixture["tone"], string> = {
  positive: "text-[var(--fg-positive)]",
  muted: "text-[var(--fg-muted)]",
};

function MeetupRow({ meetup }: { meetup: MeetupFixture }) {
  const Icon = meetup.icon;

  return (
    <li className="border-b border-[var(--stroke-neutral)]">
      <Link
        className="flex min-h-[124px] w-full items-start gap-3 py-3 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-[-2px]"
        href={meetup.href}
        aria-label={`${meetup.title}, ${meetup.dateLabel}, ${meetup.location}, ${meetup.participantState}, ${meetup.meetupState}, ${meetup.currentAction}, ${meetup.transition}`}
      >
        <Icon className={`mt-0.5 shrink-0 ${toneClasses[meetup.tone]}`} size={22} strokeWidth={1.8} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[length:var(--type-title)] font-bold leading-5 text-[var(--fg-neutral)]">
            {meetup.title}
          </span>
          <span className="mt-1 block text-[length:var(--type-meta)] leading-4 text-[var(--fg-muted)]">
            <time dateTime={meetup.dateTime}>{meetup.dateLabel}</time>
            {" · "}
            {meetup.location}
          </span>
          <span className="mt-1 block text-[length:var(--type-meta)] leading-4 text-[var(--fg-muted)]">
            {meetup.participantState}
          </span>
          <span className="mt-1 block text-[length:var(--type-body)] font-bold leading-[22px] text-[var(--fg-neutral)]">
            {meetup.meetupState} · {meetup.currentAction}
          </span>
          <span className="block text-[length:var(--type-meta)] leading-4 text-[var(--fg-muted)]">
            {meetup.transition}
          </span>
        </span>
        <ChevronRight
          className="mt-0.5 shrink-0 text-[var(--fg-muted)]"
          size={22}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

function MeetupGroup({
  id,
  title,
  meetups,
}: {
  id: string;
  title: string;
  meetups: MeetupFixture[];
}) {
  return (
    <section aria-labelledby={id}>
      <h2
        className="font-display m-0 mb-2 text-[length:var(--type-section)] font-normal leading-6 text-[var(--fg-neutral)]"
        id={id}
      >
        {title}
      </h2>
      <ul className="m-0 list-none p-0">
        {meetups.map((meetup) => (
          <MeetupRow key={meetup.href} meetup={meetup} />
        ))}
      </ul>
    </section>
  );
}

export default function MyMeetupsPage() {
  return (
    <main className="app-viewport">
      <div className="home-shell">
        <header className="root-tab-header flex min-h-[76px] shrink-0 items-center px-5">
          <h1 className="font-display m-0 text-[length:var(--type-page-title)] font-normal leading-6 text-[var(--fg-neutral)]">
            내 모임
          </h1>
        </header>

        <div className="flex-1 px-5 pb-[92px] pt-6">
          <MeetupGroup id="active-meetups-title" title="참여 중" meetups={activeMeetups} />
          <div className="mt-7">
            <MeetupGroup id="completed-meetups-title" title="완료" meetups={completedMeetups} />
          </div>
        </div>

      </div>
    </main>
  );
}
