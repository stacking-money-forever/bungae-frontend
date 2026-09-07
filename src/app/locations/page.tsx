"use client";

import { Check, MapPin, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import {
  AnimatedDialog,
  AnimatedDialogClose,
  AnimatedDialogDescription,
  AnimatedDialogTitle,
} from "@/components/animated-dialog";
import {
  defaultHomeFilters,
  HomeChrome,
  homeLocations,
  readFiltersFromSearch,
  serializeHomeFilters,
} from "@/components/home-surface";
import { setNavigationIntent } from "@/components/navigation-intent";

type LocationPermissionStatus =
  | "idle"
  | "checking"
  | "granted"
  | "denied"
  | "error"
  | "unsupported";

const locationPermissionMessages: Record<LocationPermissionStatus, string> = {
  idle: "현재 위치 권한은 선택 사항이에요. 목록에서 동네를 직접 선택할 수 있어요.",
  checking: "현재 위치 권한을 확인하는 중이에요.",
  granted: "현재 위치를 확인했어요. 이 화면에서는 동네 이름을 직접 선택해 주세요.",
  denied: "현재 위치 권한이 꺼져 있어요. 브라우저 설정에서 허용하거나 동네를 직접 선택해 주세요.",
  error: "현재 위치를 확인하지 못했어요. 동네를 직접 선택해 주세요.",
  unsupported: "이 브라우저에서는 현재 위치를 확인할 수 없어요. 동네를 직접 선택해 주세요.",
};

function LocationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilters = readFiltersFromSearch(searchParams);
  const [draftLocation, setDraftLocation] = useState(initialFilters.location);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [locationPermissionStatus, setLocationPermissionStatus] =
    useState<LocationPermissionStatus>("idle");
  const sourceFiltersRef = useRef(initialFilters);
  const destinationLocationRef = useRef(initialFilters.location);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchKey = searchParams.toString();

  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const visibleLocations = homeLocations.filter((location) =>
    `${location.name} ${location.description}`
      .toLocaleLowerCase("ko-KR")
      .includes(normalizedQuery),
  );

  useEffect(() => {
    const nextFilters = readFiltersFromSearch(new URLSearchParams(searchKey));
    sourceFiltersRef.current = nextFilters;
    destinationLocationRef.current = nextFilters.location;
    setDraftLocation(nextFilters.location);
  }, [searchKey]);
  const previewFilters = { ...sourceFiltersRef.current, location: draftLocation };

  const checkLocationPermission = () => {
    if (!navigator.geolocation) {
      setLocationPermissionStatus("unsupported");
      return;
    }

    setLocationPermissionStatus("checking");
    navigator.geolocation.getCurrentPosition(
      () => setLocationPermissionStatus("granted"),
      (error) => setLocationPermissionStatus(error.code === 1 ? "denied" : "error"),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8_000 },
    );
  };

  const navigateHome = () => {
    const targetFilters = {
      ...sourceFiltersRef.current,
      location: destinationLocationRef.current,
    };
    const queryString = serializeHomeFilters(targetFilters);
    const target = queryString ? `/?${queryString}` : "/";
    setNavigationIntent("sheet", target);
    router.push(target);
  };

  const applyLocation = () => {
    destinationLocationRef.current = draftLocation;
    setIsOpen(false);
  };

  return (
    <>
      <div aria-hidden="true" inert data-testid="location-home-surface">
        <main className="app-viewport">
          <div className="home-shell">
            <HomeChrome filters={previewFilters} />
          </div>
        </main>
      </div>

      <AnimatedDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        onExitComplete={navigateHome}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <AnimatedDialogTitle className="m-0 font-display text-[22px] font-normal leading-7 text-[var(--fg-neutral)]">
          동네 바꾸기
        </AnimatedDialogTitle>
        <AnimatedDialogDescription className="m-0 mt-1 text-[13px] leading-5 text-[var(--fg-muted)]">
          선택한 동네를 기준으로 가까운 벙개를 보여드려요.
        </AnimatedDialogDescription>
        <label className="mt-4 flex min-h-[48px] items-center gap-2 rounded-[12px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-3 focus-within:border-[var(--fg-neutral)] focus-within:ring-2 focus-within:ring-[var(--fg-neutral)]">
          <Search className="shrink-0 text-[var(--fg-muted)]" size={18} strokeWidth={1.8} aria-hidden="true" />
          <span className="sr-only">동네 검색</span>
          <input
            ref={searchRef}
            className="min-h-[44px] min-w-0 flex-1 bg-transparent text-[14px] text-[var(--fg-neutral)] outline-none placeholder:text-[var(--fg-muted)]"
            type="search"
            value={query}
            placeholder="동네 이름 검색"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="mt-3 flex items-center gap-3 rounded-[12px] bg-[var(--bg-layer-default)] px-3 py-2">
          <MapPin className="shrink-0 text-[var(--fg-muted)]" size={18} strokeWidth={1.8} aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13px] font-semibold leading-5 text-[var(--fg-neutral)]">현재 위치 권한</p>
            <p className="m-0 text-[12px] leading-4 text-[var(--fg-muted)]" role="status" aria-live="polite">
              {locationPermissionMessages[locationPermissionStatus]}
            </p>
          </div>
          <button
            className="min-h-[44px] shrink-0 rounded-[8px] px-2 text-[13px] font-bold text-[var(--fg-neutral)] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            type="button"
            onClick={checkLocationPermission}
            disabled={locationPermissionStatus === "checking"}
          >
            {locationPermissionStatus === "idle" ? "확인" : "다시 확인"}
          </button>
        </div>

        <button
          className="mt-3 flex min-h-[48px] w-full items-center gap-3 rounded-[12px] bg-[var(--bg-layer-default)] px-3 text-left text-[14px] font-semibold text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
          type="button"
          onClick={() => setDraftLocation(defaultHomeFilters.location)}
        >
          <MapPin size={19} strokeWidth={1.8} aria-hidden="true" />
          기본 동네 · 마포구 망원동
        </button>

        <div className="mt-2 max-h-[260px] overflow-y-auto" role="radiogroup" aria-label="선택 가능한 동네">
          {visibleLocations.length > 0 ? (
            visibleLocations.map((location) => {
              const selected = location.name === draftLocation;
              return (
                <label
                  className="flex min-h-[64px] cursor-pointer items-center gap-3 border-b border-[var(--stroke-neutral)] py-2"
                  key={location.name}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="location"
                    value={location.name}
                    checked={selected}
                    onChange={() => setDraftLocation(location.name)}
                  />
                  <MapPin className="shrink-0 text-[var(--fg-muted)]" size={19} strokeWidth={1.8} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold leading-5 text-[var(--fg-neutral)]">{location.name}</span>
                    <span className="block truncate text-[12px] leading-4 text-[var(--fg-muted)]">{location.description}</span>
                  </span>
                  {selected ? <Check className="shrink-0" size={20} strokeWidth={2} aria-hidden="true" /> : null}
                </label>
              );
            })
          ) : (
            <p className="m-0 py-8 text-center text-[14px] text-[var(--fg-muted)]" role="status" aria-live="polite">
              검색 결과가 없어요. 다른 동네 이름을 입력해 주세요.
            </p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-[1fr_2fr] gap-2">
          <AnimatedDialogClose asChild>
            <button
              className="min-h-[var(--action-primary-height)] rounded-[12px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] text-[14px] font-bold text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              type="button"
            >
              취소
            </button>
          </AnimatedDialogClose>
          <button
            className="min-h-[var(--action-primary-height)] rounded-[12px] bg-[var(--brand-accent)] px-4 text-[14px] font-bold text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            type="button"
            onClick={applyLocation}
          >
            이 동네에서 보기
          </button>
        </div>
      </AnimatedDialog>
    </>
  );
}

export default function LocationsPage() {
  return (
    <Suspense
      fallback={
        <main className="app-viewport">
          <div className="home-shell">
            <HomeChrome filters={defaultHomeFilters} />
          </div>
        </main>
      }
    >
      <LocationsPageContent />
    </Suspense>
  );
}
