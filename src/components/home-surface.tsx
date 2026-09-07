"use client";

import { ChevronDown, Plus, SlidersHorizontal, Zap } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Meetup, MeetupListQuery } from "@/lib/api/types";
import { useOptionalAuthSession } from "@/lib/auth/auth-session-provider";
import { ApiProblemError } from "@/lib/api/client";
import { SessionExpiredError } from "@/lib/auth/session-store";
import { MeetupListRow, type MeetupListRowProps } from "@/components/meetup-list-row";
import { NavigationLink } from "@/components/navigation-link";

export interface HomeFilters {
  location: string;
  activity: string;
  time: string;
  distance: string;
  costAlcohol: string;
  availableOnly: boolean;
}

export const homeLocations = [
  { name: "마포구 망원동", description: "망원역과 망원한강공원 주변", latitude: 37.5562, longitude: 126.9019 },
  { name: "마포구 합정동", description: "합정역과 양화진 주변", latitude: 37.5498, longitude: 126.9139 },
  { name: "마포구 상수동", description: "상수역과 홍대 걷고싶은거리 주변", latitude: 37.5477, longitude: 126.9225 },
  { name: "마포구 연남동", description: "경의선숲길과 연트럴파크 주변", latitude: 37.5666, longitude: 126.9258 },
] as const;

export type HomeLocationName = (typeof homeLocations)[number]["name"];

export const defaultHomeFilters: HomeFilters = {
  location: "마포구 망원동",
  activity: "전체",
  time: "24시간",
  distance: "2km 이내",
  costAlcohol: "전체",
  availableOnly: false,
};

const allowedFilterValues = {
  location: new Set(homeLocations.map((location) => location.name)),
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

export function readFiltersFromSearch(searchParams: Pick<URLSearchParams, "get"> | null): HomeFilters {
  return {
    location: readAllowedFilterValue(searchParams?.get("location"), allowedFilterValues.location, defaultHomeFilters.location),
    activity: readAllowedFilterValue(searchParams?.get("activity"), allowedFilterValues.activity, defaultHomeFilters.activity),
    time: readAllowedFilterValue(searchParams?.get("time"), allowedFilterValues.time, defaultHomeFilters.time),
    distance: readAllowedFilterValue(searchParams?.get("distance"), allowedFilterValues.distance, defaultHomeFilters.distance),
    costAlcohol: readAllowedFilterValue(searchParams?.get("costAlcohol"), allowedFilterValues.costAlcohol, defaultHomeFilters.costAlcohol),
    availableOnly: searchParams?.get("available") === "1",
  };
}

export function serializeHomeFilters(filters: HomeFilters) {
  const query = new URLSearchParams();
  if (filters.location !== defaultHomeFilters.location) query.set("location", filters.location);
  if (filters.activity !== defaultHomeFilters.activity) query.set("activity", filters.activity);
  if (filters.time !== defaultHomeFilters.time) query.set("time", filters.time);
  if (filters.distance !== defaultHomeFilters.distance) query.set("distance", filters.distance);
  if (filters.costAlcohol !== defaultHomeFilters.costAlcohol) query.set("costAlcohol", filters.costAlcohol);
  if (filters.availableOnly) query.set("available", "1");
  return query.toString();
}

export function filterSummaryLabel(filters: HomeFilters) {
  return `${filters.time} · ${filters.distance.replace(" 이내", "")} · ${filters.costAlcohol === "전체" ? "전체 비용" : filters.costAlcohol.split(" · ")[0]}`;
}

/**
 * Shared discovery chrome: brand, neighborhood entry, and filter entry. It is
 * the only home surface piece a sheet background needs and carries no meetup
 * data, so it cannot present fixture rows or a fabricated count.
 */
export function HomeChrome({
  filters,
  liveCount,
}: {
  filters: HomeFilters;
  /** Real server-derived count; omit to show no count surface at all. */
  liveCount?: number | null;
}) {
  const serializedFilters = serializeHomeFilters(filters);
  const filterHref = serializedFilters ? `/filters?${serializedFilters}` : "/filters";
  const locationHref = serializedFilters ? `/locations?${serializedFilters}` : "/locations";
  return (
    <header className="home-header">
      <Link className="brand-link" href="/" aria-label="벙개 홈">
        <span className="brand-mark" aria-hidden="true"><Zap size={23} strokeWidth={2.3} /></span>
        <span className="brand-wordmark font-display !text-[length:var(--type-wordmark)] !leading-6">벙개</span>
      </Link>
      <NavigationLink className="location-link font-display !text-[length:var(--type-page-title)] !leading-6" href={locationHref} navigationIntent="sheet" aria-label={`동네 변경, 현재 ${filters.location}`}>
        <span>{filters.location}</span><ChevronDown size={18} strokeWidth={1.8} aria-hidden="true" />
      </NavigationLink>
      <div className="filter-row">
        <p className="filter-summary !text-[length:var(--type-body)] !leading-[22px]">{filterSummaryLabel(filters)}</p>
        <NavigationLink className="filter-link !text-[length:var(--type-action)] !leading-6" href={filterHref} navigationIntent="sheet">
          <span className="filter-link__surface"><SlidersHorizontal size={14} strokeWidth={1.8} aria-hidden="true" />필터 변경</span>
        </NavigationLink>
      </div>
      {liveCount === null || liveCount === undefined ? null : (
        <p className="m-0 text-[length:var(--type-meta)] leading-4 text-[var(--fg-muted)]" aria-live="polite">
          모임 {liveCount}개
        </p>
      )}
    </header>
  );
}

export function HomeSurface({ filters = defaultHomeFilters }: { filters?: HomeFilters }) {
  return (
    <main className="app-viewport">
      <div className="home-shell">
        <HomeChrome filters={filters} />
        <div className="meetup-feed">
          <section className="px-[var(--dimension-x4)] py-12 text-center" role="status">
            <h1 className="font-display text-[length:var(--type-section)]">로그인 후 모임을 찾아볼 수 있어요</h1>
            <p className="mt-2 text-[length:var(--type-body)] text-[var(--fg-muted)]">
              지금 둘러보는 화면은 로그인한 뒤 가까운 모임을 보여드려요.
            </p>
            <Link
              className="mt-4 inline-flex min-h-[var(--action-primary-height)] items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              href="/auth"
            >
              로그인하기
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}

const activityCodes: Readonly<Record<string, string>> = {
  식사: "DINING",
  산책: "WALK",
  "카페 대화": "COFFEE",
};

export function homeFiltersToMeetupQuery(
  filters: HomeFilters,
  now: Date = new Date(),
): MeetupListQuery {
  const location = homeLocations.find((item) => item.name === filters.location);
  const query: MeetupListQuery = {
    activityCode: filters.activity === "전체" ? undefined : activityCodes[filters.activity],
    latitude: location?.latitude,
    longitude: location?.longitude,
    radiusMeters:
      filters.distance === "2km 이내" ? 2000 : filters.distance === "5km 이내" ? 5000 : undefined,
    joinableOnly: filters.availableOnly || undefined,
  };
  if (filters.costAlcohol === "무료 · 음주 없음") {
    query.maxCost = 0;
    query.alcoholPolicy = "NOT_ALLOWED";
  } else if (filters.costAlcohol === "유료 포함 · 음주 없음") {
    query.alcoholPolicy = "NOT_ALLOWED";
  } else if (filters.costAlcohol === "무료 · 음주 있음") {
    query.maxCost = 0;
    query.alcoholPolicy = "ALLOWED";
  }
  if (filters.time === "24시간") {
    query.startsAtFrom = now.toISOString();
    query.startsAtTo = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  } else {
    const from = new Date(now);
    const to = new Date(now);
    if (filters.time === "오늘 저녁") {
      from.setHours(17, 0, 0, 0);
      to.setHours(21, 0, 0, 0);
    } else if (filters.time === "오늘 밤") {
      from.setHours(21, 0, 0, 0);
      to.setDate(to.getDate() + 1);
      to.setHours(5, 0, 0, 0);
    } else {
      from.setDate(from.getDate() + 1);
      to.setDate(to.getDate() + 1);
      from.setHours(6, 0, 0, 0);
      to.setHours(12, 0, 0, 0);
    }
    query.startsAtFrom = from.toISOString();
    query.startsAtTo = to.toISOString();
  }
  return query;
}

function meetupRow(meetup: Meetup): MeetupListRowProps {
  return {
    imageSrc: "/images/meetups/han-river-walk-grid.jpg",
    imageAlt: "공개 장소 모임",
    time: new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(meetup.startsAt)),
    title: meetup.title,
    currentParticipants: meetup.joinedCount,
    minimumParticipants: meetup.minimumParticipants,
    capacity: meetup.capacity,
    status: meetup.state === "CONFIRMED" ? "confirmed" : "needs-members",
    href: `/meetups/${encodeURIComponent(meetup.id)}`,
  };
}

type DiscoveryState = {
  subject: string | null;
  epoch: number;
  queryKey: string;
  status: "loading" | "ready" | "error";
  items: Meetup[];
  nextCursor?: string;
  loadingMore: boolean;
  error: string | null;
};

export function AuthenticatedHomeSurface({ filters }: { filters: HomeFilters }) {
  const auth = useOptionalAuthSession();
  const subject = auth?.snapshot.status === "authenticated" ? auth.snapshot.user.id : null;
  const sessionEpoch = auth?.sessionEpoch ?? 0;
  const { activity, availableOnly, costAlcohol, distance, location, time } = filters;
  const query = useMemo(
    () => homeFiltersToMeetupQuery({ activity, availableOnly, costAlcohol, distance, location, time }),
    [activity, availableOnly, costAlcohol, distance, location, time],
  );
  const unsupportedActivity = activity !== "전체" && activityCodes[activity] === undefined;
  const queryKey = useMemo(() => JSON.stringify({ activity, query }), [activity, query]);
  const subjectRef = useRef(subject);
  subjectRef.current = subject;
  const epochRef = useRef(sessionEpoch);
  epochRef.current = sessionEpoch;
  const request = useRef(0);
  const [state, setState] = useState<DiscoveryState>({
    subject: null,
    epoch: 0,
    queryKey: "",
    status: "loading",
    items: [],
    loadingMore: false,
    error: null,
  });
  const current =
    state.subject === subject && state.epoch === sessionEpoch && state.queryKey === queryKey
      ? state
      : { ...state, status: "loading" as const, items: [], nextCursor: undefined, loadingMore: false, error: null };
  const load = useCallback(
    async (cursor?: string, append = false) => {
      if (!subject || !auth || unsupportedActivity) return;
      const generation = ++request.current;
      setState((previous) => {
        const preserveItems =
          append &&
          previous.subject === subject &&
          previous.epoch === sessionEpoch &&
          previous.queryKey === queryKey;
        return {
          subject,
          epoch: sessionEpoch,
          queryKey,
          status: preserveItems ? "ready" : "loading",
          items: preserveItems ? previous.items : [],
          nextCursor: preserveItems ? previous.nextCursor : undefined,
          loadingMore: preserveItems,
          error: null,
        };
      });
      try {
        const page = await auth.listMeetups({ ...query, cursor });
        if (request.current !== generation || subjectRef.current !== subject || epochRef.current !== sessionEpoch) return;
        setState((previous) => ({
          subject,
          epoch: sessionEpoch,
          queryKey,
          status: "ready",
          items:
            append &&
            previous.subject === subject &&
            previous.epoch === sessionEpoch &&
            previous.queryKey === queryKey
              ? [...previous.items, ...page.items]
              : page.items,
          nextCursor: page.nextCursor,
          loadingMore: false,
          error: null,
        }));
      } catch (error) {
        if (request.current !== generation || subjectRef.current !== subject || epochRef.current !== sessionEpoch || error instanceof SessionExpiredError) return;
        setState((previous) => {
          const preserveItems =
            append &&
            previous.subject === subject &&
            previous.epoch === sessionEpoch &&
            previous.queryKey === queryKey;
          return {
            subject,
            epoch: sessionEpoch,
            queryKey,
            status: preserveItems ? "ready" : "error",
            items: preserveItems ? previous.items : [],
            nextCursor: preserveItems ? previous.nextCursor : undefined,
            loadingMore: false,
            error: error instanceof ApiProblemError ? error.problem?.detail ?? "모임을 불러오지 못했어요." : "모임을 불러오지 못했어요.",
          };
        });
      }
    },
    [auth, query, queryKey, sessionEpoch, subject, unsupportedActivity],
  );

  useEffect(() => {
    request.current += 1;
    if (!subject) return;
    if (unsupportedActivity) {
      setState({
        subject,
        epoch: sessionEpoch,
        queryKey,
        status: "ready",
        items: [],
        nextCursor: undefined,
        loadingMore: false,
        error: null,
      });
      return;
    }
    void load();
    return () => {
      request.current += 1;
    };
  }, [load, queryKey, sessionEpoch, subject, unsupportedActivity]);

  return (
    <main className="app-viewport">
      <div className="home-shell">
        <HomeChrome filters={filters} liveCount={current.status === "ready" ? current.items.length : null} />
        <div className="meetup-feed">
          {current.status === "loading" ? <section className="px-[var(--dimension-x4)] py-12 text-center" role="status">모임을 불러오는 중이에요.</section> : null}
          {current.error ? <section className="px-[var(--dimension-x4)] py-12 text-center" role="alert"><p>{current.error}</p><button type="button" onClick={() => void load(current.items.length > 0 ? current.nextCursor : undefined, current.items.length > 0)} className="min-h-[44px] border border-[var(--stroke-neutral)] px-3">다시 시도</button></section> : null}
          {current.status === "ready" && unsupportedActivity ? <section className="px-[var(--dimension-x4)] py-12 text-center" role="status"><h1 className="font-display text-[length:var(--type-section)]">현재 지원하지 않는 활동이에요</h1><p className="mt-2 text-[length:var(--type-body)] text-[var(--fg-muted)]">{filters.activity} 활동은 아직 서버 탐색에서 지원하지 않아요.</p></section> : null}
          {current.status === "ready" && !unsupportedActivity && current.items.length === 0 ? <section className="px-[var(--dimension-x4)] py-12 text-center" role="status"><h1 className="font-display text-[length:var(--type-section)]">조건에 맞는 모임이 없어요</h1><p className="mt-2 text-[length:var(--type-body)] text-[var(--fg-muted)]">필터를 바꾸거나 새 모임을 만들어 보세요.</p></section> : null}
          {current.status === "ready" && !unsupportedActivity && current.items.length > 0 ? <section className="meetup-section" aria-labelledby="meetup-api-results"><h1 id="meetup-api-results" className="font-display !text-[length:var(--type-section)] !leading-6">탐색 결과</h1><ul className="meetup-list">{current.items.map((meetup) => <MeetupListRow key={meetup.id} {...meetupRow(meetup)} />)}</ul>{current.nextCursor ? <button type="button" disabled={current.loadingMore} onClick={() => void load(current.nextCursor, true)} className="mt-3 min-h-[44px] w-full border border-[var(--stroke-neutral)] px-3 text-[length:var(--type-action)]">모임 더 보기</button> : null}</section> : null}
        </div>
        <Link className="create-fab !text-[length:var(--type-action)] !leading-6" href="/meetups/new"><Plus size={22} strokeWidth={1.8} aria-hidden="true" /><span>모임 만들기</span></Link>
      </div>
    </main>
  );
}

export function HomeSurfaceFromSearch() {
  const searchParams = useSearchParams();
  const filters = readFiltersFromSearch(searchParams);
  const auth = useOptionalAuthSession();
  return auth?.snapshot.status === "authenticated" ? <AuthenticatedHomeSurface filters={filters} /> : <HomeSurface filters={filters} />;
}
