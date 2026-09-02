"use client";

import { ChevronDown, Plus, SlidersHorizontal, Zap } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { MeetupListRow, type MeetupListRowProps } from "@/components/meetup-list-row";
import { NavigationLink } from "@/components/navigation-link";

export interface HomeFilters {
  activity: string;
  time: string;
  distance: string;
  costAlcohol: string;
  availableOnly: boolean;
}

type HomeMeetup = MeetupListRowProps & {
  activity: string;
  distanceKm: number;
  cost: number;
  alcohol: boolean;
  available: boolean;
};

type MeetupGroup = { title: string; meetups: HomeMeetup[] };

export const defaultHomeFilters: HomeFilters = {
  activity: "전체",
  time: "24시간",
  distance: "2km 이내",
  costAlcohol: "전체",
  availableOnly: false,
};

const allowedFilterValues = {
  activity: new Set(["전체", "식사", "산책", "보드게임", "카페 대화"]),
  time: new Set(["24시간", "오늘 저녁", "오늘 밤", "내일 오전"]),
  distance: new Set(["2km 이내", "5km 이내", "거리 제한 없음"]),
  costAlcohol: new Set(["무료 · 음주 없음", "유료 포함 · 음주 없음", "무료 · 음주 있음", "전체"]),
};

function readAllowedFilterValue(
  value: string | null | undefined,
  allowed: Set<string>,
  fallback: string,
) {
  return value && allowed.has(value) ? value : fallback;
}

export const meetupGroups: MeetupGroup[] = [
  {
    title: "오늘 저녁",
    meetups: [
      { imageSrc: "/images/meetups/han-river-walk-grid.jpg", imageAlt: "저녁의 한강변 공개 산책로", time: "18:30", title: "퇴근 후 한강 산책", currentParticipants: 2, minimumParticipants: 3, capacity: 6, status: "needs-members", href: "/meetups/han-river-walk", activity: "산책", distanceKm: 1.2, cost: 0, alcohol: false, available: true },
      { imageSrc: "/images/meetups/board-game-grid.jpg", imageAlt: "공개 보드게임 카페의 게임 테이블", time: "19:00", title: "합정 보드게임", currentParticipants: 6, minimumParticipants: 3, capacity: 6, status: "confirmed", href: "/meetups/hapjeong-board-games", activity: "보드게임", distanceKm: 1.8, cost: 10000, alcohol: false, available: false },
    ],
  },
  {
    title: "오늘 밤",
    meetups: [
      { imageSrc: "/images/meetups/cafe-chat-grid.jpg", imageAlt: "동네 카페의 커피와 대화하는 손짓", time: "21:30", title: "상수 카페 대화", currentParticipants: 3, minimumParticipants: 3, capacity: 6, status: "confirmed", href: "/meetups/sangsu-cafe-chat", activity: "카페 대화", distanceKm: 0.8, cost: 6000, alcohol: false, available: true },
      { imageSrc: "/images/meetups/han-river-walk-grid.jpg", imageAlt: "저녁의 한강변 공개 산책로", time: "22:00", title: "월드컵공원 야간 산책", currentParticipants: 2, minimumParticipants: 3, capacity: 5, status: "needs-members", href: "/meetups/world-cup-park-night-walk", activity: "산책", distanceKm: 1.9, cost: 0, alcohol: false, available: true },
    ],
  },
  {
    title: "내일 오전",
    meetups: [
      { imageSrc: "/images/meetups/cafe-chat-grid.jpg", imageAlt: "동네 카페의 커피와 대화하는 손짓", time: "08:30", title: "망원 모닝 커피", currentParticipants: 2, minimumParticipants: 2, capacity: 4, status: "confirmed", href: "/meetups/mangwon-morning-coffee", activity: "카페 대화", distanceKm: 0.6, cost: 5500, alcohol: false, available: true },
      { imageSrc: "/images/meetups/han-river-walk-grid.jpg", imageAlt: "저녁의 한강변 공개 산책로", time: "10:00", title: "한강 브런치 산책", currentParticipants: 1, minimumParticipants: 3, capacity: 6, status: "needs-members", href: "/meetups/han-river-brunch-walk", activity: "산책", distanceKm: 1.5, cost: 0, alcohol: false, available: true },
    ],
  },
];

export function filterMeetupGroups(groups: MeetupGroup[], filters: HomeFilters) {
  const maximumDistance = filters.distance === "2km 이내" ? 2 : filters.distance === "5km 이내" ? 5 : Infinity;
  return groups
    .filter((group) => filters.time === "24시간" || group.title === filters.time)
    .map((group) => ({
      ...group,
      meetups: group.meetups.filter((meetup) => {
        const activityMatches = filters.activity === "전체" || meetup.activity === filters.activity;
        const distanceMatches = meetup.distanceKm <= maximumDistance;
        const availabilityMatches = !filters.availableOnly || meetup.available;
        const costAlcoholMatches =
          filters.costAlcohol === "전체" ||
          (filters.costAlcohol === "무료 · 음주 없음" && meetup.cost === 0 && !meetup.alcohol) ||
          (filters.costAlcohol === "유료 포함 · 음주 없음" && !meetup.alcohol) ||
          (filters.costAlcohol === "무료 · 음주 있음" && meetup.cost === 0 && meetup.alcohol);
        return activityMatches && distanceMatches && availabilityMatches && costAlcoholMatches;
      }),
    }))
    .filter((group) => group.meetups.length > 0);
}

export function readFiltersFromSearch(searchParams: Pick<URLSearchParams, "get"> | null): HomeFilters {
  return {
    activity: readAllowedFilterValue(searchParams?.get("activity"), allowedFilterValues.activity, defaultHomeFilters.activity),
    time: readAllowedFilterValue(searchParams?.get("time"), allowedFilterValues.time, defaultHomeFilters.time),
    distance: readAllowedFilterValue(searchParams?.get("distance"), allowedFilterValues.distance, defaultHomeFilters.distance),
    costAlcohol: readAllowedFilterValue(searchParams?.get("costAlcohol"), allowedFilterValues.costAlcohol, defaultHomeFilters.costAlcohol),
    availableOnly: searchParams?.get("available") === "1",
  };
}

export function serializeHomeFilters(filters: HomeFilters) {
  const query = new URLSearchParams();
  if (filters.activity !== defaultHomeFilters.activity) query.set("activity", filters.activity);
  if (filters.time !== defaultHomeFilters.time) query.set("time", filters.time);
  if (filters.distance !== defaultHomeFilters.distance) query.set("distance", filters.distance);
  if (filters.costAlcohol !== defaultHomeFilters.costAlcohol) query.set("costAlcohol", filters.costAlcohol);
  if (filters.availableOnly) query.set("available", "1");
  return query.toString();
}

export function HomeSurface({ filters = defaultHomeFilters }: { filters?: HomeFilters }) {
  const visibleGroups = filterMeetupGroups(meetupGroups, filters);
  const filterSummary = `${filters.time} · ${filters.distance.replace(" 이내", "")} · ${filters.costAlcohol === "전체" ? "전체 비용" : filters.costAlcohol.split(" · ")[0]}`;
  const serializedFilters = serializeHomeFilters(filters);
  const filterHref = serializedFilters ? `/filters?${serializedFilters}` : "/filters";
  return (
    <main className="app-viewport">
      <div className="home-shell">
        <header className="home-header">
          <Link className="brand-link" href="/" aria-label="벙개 홈">
            <span className="brand-mark" aria-hidden="true"><Zap size={23} strokeWidth={2.3} /></span>
            <span className="brand-wordmark font-display !text-[length:var(--type-wordmark)] !leading-6">벙개</span>
          </Link>
          <NavigationLink className="location-link font-display !text-[length:var(--type-page-title)] !leading-6" href={filterHref} navigationIntent="sheet" aria-label="현재 위치 마포구 망원동">
            <span>마포구 망원동</span><ChevronDown size={18} strokeWidth={1.8} aria-hidden="true" />
          </NavigationLink>
          <div className="filter-row">
            <p className="filter-summary !text-[length:var(--type-body)] !leading-[22px]">{filterSummary}</p>
            <NavigationLink className="filter-link !text-[length:var(--type-action)] !leading-6" href={filterHref} navigationIntent="sheet">
              <span className="filter-link__surface"><SlidersHorizontal size={14} strokeWidth={1.8} aria-hidden="true" />필터 변경</span>
            </NavigationLink>
          </div>
        </header>
        <div className="meetup-feed">
          {visibleGroups.map((group, index) => {
            const headingId = `meetup-section-${index}`;
            return (
              <section className="meetup-section" aria-labelledby={headingId} key={group.title}>
                <h1 id={headingId} className="font-display !text-[length:var(--type-section)] !leading-6">{group.title}</h1>
                <ul className="meetup-list">
                  {group.meetups.map((meetup) => <MeetupListRow key={meetup.href} {...meetup} />)}
                </ul>
              </section>
            );
          })}
          {visibleGroups.length === 0 ? (
            <section className="px-[var(--dimension-x4)] py-12 text-center" role="status">
              <h1 className="font-display text-[length:var(--type-section)]">조건에 맞는 모임이 없어요</h1>
              <p className="mt-2 text-[length:var(--type-body)] text-[var(--fg-muted)]">필터를 바꾸거나 새 모임을 만들어 보세요.</p>
            </section>
          ) : null}
        </div>
        <Link className="create-fab !text-[length:var(--type-action)] !leading-6" href="/meetups/new">
          <Plus size={22} strokeWidth={1.8} aria-hidden="true" /><span>모임 만들기</span>
        </Link>
      </div>
    </main>
  );
}

export function HomeSurfaceFromSearch() {
  const searchParams = useSearchParams();
  return <HomeSurface filters={readFiltersFromSearch(searchParams)} />;
}
