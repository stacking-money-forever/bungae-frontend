import { ChevronDown, Plus, Zap } from "lucide-react";
import Link from "next/link";

import { BottomNavigation } from "@/components/bottom-navigation";
import { MeetupListRow, type MeetupListRowProps } from "@/components/meetup-list-row";

const meetups: MeetupListRowProps[] = [
  {
    time: "18:30",
    title: "퇴근 후 한강 산책",
    currentParticipants: 2,
    minimumParticipants: 3,
    capacity: 6,
    status: "needs-members",
    href: "/meetups/han-river-walk",
  },
  {
    time: "19:00",
    title: "합정 보드게임",
    currentParticipants: 4,
    minimumParticipants: 3,
    capacity: 6,
    status: "confirmed",
    href: "/meetups/hapjeong-board-games",
  },
  {
    time: "19:30",
    title: "상수 카페 대화",
    currentParticipants: 3,
    minimumParticipants: 3,
    capacity: 6,
    status: "confirmed",
    href: "/meetups/sangsu-cafe-chat",
  },
];

export default function HomePage() {
  return (
    <main className="app-viewport">
      <div className="home-shell">
        <header className="home-header">
          <Link className="brand-link" href="/" aria-label="벙개 홈">
            <span className="brand-mark" aria-hidden="true">
              <Zap size={23} strokeWidth={2.3} />
            </span>
            <span className="brand-wordmark font-display !text-[length:var(--type-wordmark)] !leading-6">벙개</span>
          </Link>

          <Link
            className="location-link font-display !text-[length:var(--type-page-title)] !leading-6"
            href="/filters"
            aria-label="현재 위치 마포구 망원동"
          >
            <span>마포구 망원동</span>
            <ChevronDown size={18} strokeWidth={1.8} aria-hidden="true" />
          </Link>

          <div className="filter-row">
            <p className="filter-summary !text-[length:var(--type-body)] !leading-[22px]">오늘 · 2km · 무료</p>
            <Link className="filter-link !text-[length:var(--type-action)] !leading-6" href="/filters">
              필터 변경
            </Link>
          </div>
        </header>

        <section className="meetup-section" aria-labelledby="meetup-section-title">
          <h1
            id="meetup-section-title"
            className="font-display !text-[length:var(--type-section)] !leading-6"
          >
            오늘 저녁
          </h1>
          <ul className="meetup-list">
            {meetups.map((meetup) => (
              <MeetupListRow key={meetup.href} {...meetup} />
            ))}
          </ul>
        </section>

        <Link
          className="create-fab !text-[length:var(--type-action)] !leading-6"
          href="/meetups/new"
        >
          <Plus size={22} strokeWidth={1.8} aria-hidden="true" />
          <span>모임 만들기</span>
        </Link>

        <BottomNavigation activeTab="explore" />
      </div>
    </main>
  );
}
