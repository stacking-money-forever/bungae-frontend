"use client";

import { Check, ChevronDown, MapPin, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  AnimatedDialog,
  AnimatedDialogClose,
  AnimatedDialogDescription,
  AnimatedDialogTitle,
} from "@/components/animated-dialog";

export interface PublicPlace {
  id: string;
  name: string;
  address: string;
  isPublic: true;
}

export const PUBLIC_PLACES: PublicPlace[] = [
  {
    id: "mangwon-hangang",
    name: "망원한강공원",
    address: "서울 마포구 마포나루길 467",
    isPublic: true,
  },
  {
    id: "mangwon-market",
    name: "망원시장 입구",
    address: "서울 마포구 포은로8길 14",
    isPublic: true,
  },
  {
    id: "mangwon-station",
    name: "망원역 2번 출구",
    address: "서울 마포구 월드컵로 77",
    isPublic: true,
  },
  {
    id: "world-cup-park",
    name: "월드컵공원 평화의공원",
    address: "서울 마포구 증산로 32",
    isPublic: true,
  },
];

export interface PlacePickerProps {
  id: string;
  label: string;
  value: PublicPlace | null;
  onChange: (place: PublicPlace) => void;
  error?: string;
}

export function PlacePicker({ id, label, value, onChange, error }: PlacePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draftId, setDraftId] = useState(value?.id ?? "");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setDraftId(value?.id ?? "");
    }
  }, [open, value]);

  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const filteredPlaces = PUBLIC_PLACES.filter((place) =>
    `${place.name} ${place.address}`.toLocaleLowerCase("ko-KR").includes(normalizedQuery),
  );
  const draftPlace = PUBLIC_PLACES.find((place) => place.id === draftId) ?? null;

  return (
    <div>
      <AnimatedDialog
        open={open}
        onOpenChange={setOpen}
        placement="bottom"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchRef.current?.focus();
        }}
        trigger={
          <button
            id={`${id}-trigger`}
            className={`flex min-h-[68px] w-full items-center justify-between gap-3 rounded-[12px] border bg-[var(--bg-layer-floating)] px-4 py-2.5 text-left outline-none transition-colors hover:border-[var(--fg-muted)] focus-visible:border-[var(--fg-neutral)] focus-visible:ring-2 focus-visible:ring-[var(--fg-neutral)] focus-visible:ring-offset-2 ${error ? "border-[var(--fg-critical)]" : "border-[var(--stroke-neutral)]"}`}
            type="button"
            aria-label={`${label}, ${value?.name ?? "공개 장소 선택"}${value ? `, ${value.address}` : ""}`}
            aria-describedby={error ? `${id}-error` : undefined}
          >
            <span className="flex min-w-0 items-center gap-3">
              <MapPin className="shrink-0 text-[var(--fg-muted)]" size={20} strokeWidth={1.8} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[12px] leading-4 text-[var(--fg-muted)]">{label}</span>
                <span className="mt-0.5 block truncate text-[14px] font-semibold leading-5 text-[var(--fg-neutral)]">
                  {value?.name ?? "공개 장소 선택"}
                </span>
                {value ? (
                  <span className="block truncate text-[11px] leading-4 text-[var(--fg-muted)]">{value.address}</span>
                ) : null}
              </span>
            </span>
            <ChevronDown className="shrink-0 text-[var(--fg-muted)]" size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
        }
      >
        <AnimatedDialogTitle className="m-0 font-display text-[22px] font-normal leading-7 text-[var(--fg-neutral)]">
          공개 장소 선택
        </AnimatedDialogTitle>
        <AnimatedDialogDescription className="m-0 mt-1 text-[13px] leading-5 text-[var(--fg-muted)]">
          누구나 접근할 수 있는 장소만 등록할 수 있어요.
        </AnimatedDialogDescription>

        <label className="mt-4 flex min-h-[48px] items-center gap-2 rounded-[12px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-3 focus-within:border-[var(--fg-neutral)] focus-within:ring-2 focus-within:ring-[var(--fg-neutral)]">
          <Search className="shrink-0 text-[var(--fg-muted)]" size={18} strokeWidth={1.8} aria-hidden="true" />
          <span className="sr-only">장소 검색</span>
          <input
            ref={searchRef}
            className="min-h-[44px] min-w-0 flex-1 bg-transparent text-[14px] text-[var(--fg-neutral)] outline-none placeholder:text-[var(--fg-muted)]"
            type="search"
            value={query}
            placeholder="장소명 또는 주소"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="mt-3 max-h-[244px] overflow-y-auto" role="radiogroup" aria-label="검색된 공개 장소">
          {filteredPlaces.length > 0 ? (
            filteredPlaces.map((place) => {
              const selected = draftId === place.id;
              return (
                <label
                  key={place.id}
                  className={`flex min-h-[60px] cursor-pointer items-center gap-3 border-b border-[var(--stroke-neutral)] px-2 py-2 outline-none transition-colors last:border-b-0 ${
                    selected ? "bg-[var(--bg-positive-weak)]" : "bg-transparent"
                  }`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name={`${id}-place`}
                    value={place.id}
                    checked={selected}
                    onChange={() => setDraftId(place.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold leading-5 text-[var(--fg-neutral)]">{place.name}</span>
                    <span className="block truncate text-[12px] leading-4 text-[var(--fg-muted)]">{place.address}</span>
                  </span>
                  {selected ? <Check className="shrink-0 text-[var(--fg-positive)]" size={20} strokeWidth={2} aria-hidden="true" /> : null}
                </label>
              );
            })
          ) : (
            <p className="m-0 py-8 text-center text-[13px] text-[var(--fg-muted)]">일치하는 공개 장소가 없어요.</p>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <AnimatedDialogClose asChild>
            <button
              className="min-h-[48px] rounded-[12px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-4 text-[14px] font-semibold text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              type="button"
            >
              취소
            </button>
          </AnimatedDialogClose>
          <button
            className="min-h-[48px] rounded-[12px] bg-[var(--brand-accent)] px-4 text-[14px] font-bold text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={!draftPlace}
            onClick={() => {
              if (!draftPlace) {
                return;
              }
              onChange(draftPlace);
              setOpen(false);
            }}
          >
            이 장소 선택
          </button>
        </div>
      </AnimatedDialog>
      {error ? (
        <p id={`${id}-error`} className="m-0 mt-1.5 text-[12px] leading-4 text-[var(--fg-critical)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
