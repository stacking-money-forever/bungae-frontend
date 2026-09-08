"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BottomActionBar } from "@/components/bottom-action-bar";
import { OfflineNotice } from "@/components/offline-notice";
import { ResultSection } from "@/components/result-section";
import { ScreenShell } from "@/components/screen-shell";
import { StatusBanner } from "@/components/status-banner";
import { TimeWheelPicker } from "@/components/time-wheel-picker";
import { TopNavigation } from "@/components/top-navigation";
import {
  createTimeOptions,
  createInitialValues,
  validateMeetupForm,
  type CreateFormErrors,
  type CreateFormValues,
} from "@/lib/meetup-form";
import { ApiProblemError } from "@/lib/api/client";
import type { Meetup, MeetupCreate, ProviderPlace } from "@/lib/api/types";
import { useOptionalAuthSession } from "@/lib/auth/auth-session-provider";
import { useOnlineStatus } from "@/lib/ui/online";

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
}

function TextField({ id, label, value, onChange, placeholder, error, multiline = false }: TextFieldProps) {
  const sharedClassName =
    "mt-1 min-h-[28px] w-full resize-none bg-transparent text-[14px] font-semibold leading-5 text-[var(--fg-neutral)] outline-none placeholder:font-normal placeholder:text-[var(--fg-muted)]";

  return (
    <label
      className={`block rounded-[12px] border bg-[var(--bg-layer-floating)] px-4 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-[var(--fg-neutral)] focus-within:ring-offset-2 ${
        error ? "border-[var(--fg-critical)]" : "border-[var(--stroke-neutral)] focus-within:border-[var(--fg-neutral)]"
      }`}
      htmlFor={id}
    >
      <span className="block text-[12px] leading-4 text-[var(--fg-muted)]">{label}</span>
      {multiline ? (
        <textarea
          className={`${sharedClassName} min-h-[52px]`}
          id={id}
          name={id}
          rows={2}
          value={value}
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className={sharedClassName}
          id={id}
          name={id}
          type="text"
          value={value}
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {error ? (
        <span id={`${id}-error`} className="mt-1 block text-[12px] font-normal leading-4 text-[var(--fg-critical)]">
          {error}
        </span>
      ) : null}
    </label>
  );
}

interface NumberFieldProps {
  id: "minimum" | "capacity";
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function NumberField({ id, label, value, onChange, error }: NumberFieldProps) {
  return (
    <label
      className={`block rounded-[12px] border bg-[var(--bg-layer-floating)] px-4 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-[var(--fg-neutral)] focus-within:ring-offset-2 ${
        error ? "border-[var(--fg-critical)]" : "border-[var(--stroke-neutral)] focus-within:border-[var(--fg-neutral)]"
      }`}
      htmlFor={id}
    >
      <span className="block text-[12px] leading-4 text-[var(--fg-muted)]">{label}</span>
      <span className="mt-1 flex items-center gap-1">
        <input
          className="min-h-[28px] min-w-0 flex-1 bg-transparent text-[18px] font-bold leading-6 text-[var(--fg-neutral)] outline-none"
          id={id}
          name={id}
          type="text"
          aria-label={label}
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value.replace(/[^0-9]/g, ""))}
        />
        <span className="text-[13px] text-[var(--fg-muted)]">명</span>
      </span>
      {error ? (
        <span id={`${id}-error`} className="mt-1 block text-[12px] font-normal leading-4 text-[var(--fg-critical)]">
          {error}
        </span>
      ) : null}
    </label>
  );
}

const activityCodes: Readonly<Record<string, string>> = {
  식사: "DINING",
  산책: "WALK",
  "카페 대화": "COFFEE",
};

function createIdempotencyKey() {
  return crypto.randomUUID();
}

function parseCostAndAlcohol(value: string): Pick<MeetupCreate, "cost" | "alcoholPolicy"> | null {
  const normalized = value.replaceAll(",", "");
  const cost = normalized.includes("무료") ? 0 : Number(/(\d+)\s*원/.exec(normalized)?.[1]);
  if (!Number.isInteger(cost) || cost < 0) return null;
  return {
    cost,
    alcoholPolicy: normalized.includes("음주 있음") ? "ALLOWED" : "NOT_ALLOWED",
  };
}

function problemMessage(error: unknown) {
  if (error instanceof ApiProblemError) {
    return error.problem?.detail ?? `요청을 처리하지 못했어요. (${error.status})`;
  }
  return "네트워크 상태를 확인한 뒤 다시 시도해 주세요.";
}

function NewMeetupPageContent() {
  const auth = useOptionalAuthSession();
  const subject = auth?.snapshot.status === "authenticated" ? auth.snapshot.user.id : null;
  // Session-scoped identity: the same subject logging in again after logout is
  // a distinct UI session, so a late create completion or place result cannot
  // render in the new session.
  const sessionEpoch = auth?.sessionEpoch ?? 0;
  const sessionKey = `${sessionEpoch}:${subject ?? "anonymous"}`;
  const subjectRef = useRef(subject);
  const epochRef = useRef(sessionEpoch);
  subjectRef.current = subject;
  epochRef.current = sessionEpoch;
  const online = useOnlineStatus();
  const [timeOptions] = useState(() => createTimeOptions());
  const [values, setValues] = useState(() => createInitialValues(timeOptions));
  const [errors, setErrors] = useState<CreateFormErrors>({});
  const [isPosting, setIsPosting] = useState(false);
  const [providerPlace, setProviderPlace] = useState<ProviderPlace | null>(null);
  const [placeSearchProblem, setPlaceSearchProblem] = useState<string | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<ProviderPlace[]>([]);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [publicPlaceConfirmed, setPublicPlaceConfirmed] = useState(false);
  const [created, setCreated] = useState<{ sessionKey: string; meetup: Meetup } | null>(null);
  const [mutationProblem, setMutationProblem] = useState<string | null>(null);
  const mutationRef = useRef<{
    sessionKey: string;
    payload: string;
    idempotencyKey: string;
    inFlight: Promise<Meetup> | null;
  } | null>(null);
  const placeSearchGenerationRef = useRef(0);

  useEffect(() => {
    mutationRef.current = null;
    setCreated(null);
    setIsPosting(false);
    setMutationProblem(null);
    placeSearchGenerationRef.current += 1;
  }, [sessionKey, subject]);
  if (!subject) {
    return (
      <ScreenShell bottomSpacing reserveTabBar aria-label="로그인 필요">
        <TopNavigation href="/" title="모임 만들기" />
        <section className="px-[var(--dimension-x5)] pb-8 pt-12" aria-labelledby="create-auth-heading">
          <h2 id="create-auth-heading" className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">
            로그인하고 모임을 만들어 주세요
          </h2>
          <p className="m-0 mt-4 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
            모임 생성은 로그인한 계정의 서버 장소 검색과 생성 요청이 모두 성공한 뒤에만 완료로 표시해요.
          </p>
        </section>
        <BottomActionBar>
          <Link className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)]" href="/auth">
            휴대전화로 로그인하기
          </Link>
        </BottomActionBar>
      </ScreenShell>
    );
  }

  const searchProviderPlaces = async () => {
    if (!online) {
      setPlaceSearchProblem("인터넷 연결이 끊겨 서버 장소를 검색할 수 없어요. 연결을 확인한 뒤 다시 시도해 주세요.");
      return;
    }
    if (!auth || !subject || !placeQuery.trim()) {
      setPlaceSearchProblem("장소명 또는 주소를 입력해 주세요.");
      return;
    }
    const generation = ++placeSearchGenerationRef.current;
    const requestedSubject = subject;
    const requestedEpoch = sessionEpoch;
    setIsSearchingPlaces(true);
    setProviderPlace(null);
    setPublicPlaceConfirmed(false);
    setPlaceResults([]);
    setPlaceSearchProblem(null);
    try {
      const result = await auth.searchPlaces(placeQuery.trim());
      if (subjectRef.current !== requestedSubject || epochRef.current !== requestedEpoch || placeSearchGenerationRef.current !== generation) return;
      setPlaceResults(result.places);
      if (result.places.length === 0) setPlaceSearchProblem("일치하는 서버 장소가 없어요. 검색어를 바꿔 다시 시도해 주세요.");
    } catch (error) {
      if (subjectRef.current === requestedSubject && epochRef.current === requestedEpoch && placeSearchGenerationRef.current === generation) setPlaceSearchProblem(problemMessage(error));
    } finally {
      if (subjectRef.current === requestedSubject && epochRef.current === requestedEpoch && placeSearchGenerationRef.current === generation) setIsSearchingPlaces(false);
    }
  };

  const clearErrors = (...ids: Array<keyof CreateFormErrors>) => {
    setErrors((current) => {
      if (!ids.some((id) => current[id])) return current;
      const next = { ...current };
      ids.forEach((id) => delete next[id]);
      return next;
    });
  };

  const updateValue = <Key extends keyof CreateFormValues>(id: Key, value: CreateFormValues[Key]) => {
    mutationRef.current = null;
    setMutationProblem(null);
    setValues((current) => ({ ...current, [id]: value }));
    if (id === "start" || id === "end") clearErrors("start", "end");
    else if (id === "minimum" || id === "capacity") clearErrors("minimum", "capacity");
    else if (id === "title") clearErrors("title");
    else if (id === "place") clearErrors("place");
    else if (id === "facilitationTemplate" || id === "costAlcohol") clearErrors(id);
  };

  const postMeetup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateMeetupForm(values);
    const firstError = Object.keys(nextErrors)[0] as keyof CreateFormErrors | undefined;
    if (firstError) {
      setErrors(nextErrors);
      window.requestAnimationFrame(() => document.getElementById(
        firstError === "start" || firstError === "end" ? `${firstError}-trigger` : firstError === "place" ? "place-trigger" : firstError,
      )?.focus());
      return;
    }
    if (!subject || !auth) {
      setMutationProblem("로그인한 뒤 서버 장소를 선택하고 모임을 만들어 주세요.");
      return;
    }
    if (!online) {
      setMutationProblem("인터넷 연결이 끊겨 모임을 게시할 수 없어요. 연결을 확인한 뒤 다시 시도해 주세요.");
      return;
    }
    const activityCode = activityCodes[values.activity];
    const costAndAlcohol = parseCostAndAlcohol(values.costAlcohol);
    const start = timeOptions.find((option) => option.value === values.start);
    const end = timeOptions.find((option) => option.value === values.end);
    if (!activityCode || !costAndAlcohol || !start?.instant || !end?.instant || !providerPlace || !publicPlaceConfirmed) {
      setMutationProblem(!activityCode ? "선택한 활동은 현재 서버 생성 정책에서 지원하지 않아요." : "비용은 ‘무료’ 또는 ‘숫자원’ 형식으로 입력해 주세요.");
      return;
    }
    const now = Date.now();
    const startsAt = Date.parse(start.instant);
    const endsAt = Date.parse(end.instant);
    if (startsAt <= now || startsAt > now + 24 * 60 * 60_000 || endsAt <= startsAt) {
      setMutationProblem("선택한 시간이 만료됐어요. 시간을 다시 선택해 주세요.");
      return;
    }
    const input: MeetupCreate = {
      activityCode,
      title: values.title.trim(),
      description: values.purpose.trim(),
      startsAt: start.instant,
      endsAt: end.instant,
      minimumParticipants: Number(values.minimum),
      capacity: Number(values.capacity),
      venue: { name: providerPlace?.name ?? "", address: providerPlace?.roadAddress || providerPlace?.address || "", latitude: providerPlace?.latitude ?? Number.NaN, longitude: providerPlace?.longitude ?? Number.NaN },
      ...costAndAlcohol,
      preparation: values.preparation.trim(),
      facilitationTemplate: values.facilitationTemplate.trim(),
    };
    const payload = JSON.stringify(input);
    const attempt = mutationRef.current?.sessionKey === sessionKey && mutationRef.current.payload === payload
      ? mutationRef.current
      : { sessionKey, payload, idempotencyKey: createIdempotencyKey(), inFlight: null };
    mutationRef.current = attempt;
    if (attempt.inFlight) return;

    setErrors({});
    setMutationProblem(null);
    setIsPosting(true);
    const request = auth.createMeetup(input, attempt.idempotencyKey);
    attempt.inFlight = request;
    try {
      const meetup = await request;
      if (subjectRef.current !== subject || epochRef.current !== sessionEpoch) return;
      mutationRef.current = null;
      setCreated({ sessionKey, meetup });
    } catch (error) {
      if (subjectRef.current !== subject || epochRef.current !== sessionEpoch) return;
      setMutationProblem(problemMessage(error));
    } finally {
      if (mutationRef.current === attempt) attempt.inFlight = null;
      if (subjectRef.current === subject && epochRef.current === sessionEpoch) setIsPosting(false);
    }
  };
  const createdMeetup = created?.sessionKey === sessionKey ? created.meetup : null;

  if (createdMeetup) {
    return (
      <ScreenShell bottomSpacing reserveTabBar aria-label="모임 게시 완료">
        <TopNavigation href="/meetups/new" title="게시 완료" />
        <OfflineNotice className="mx-5 mt-5" />
        <ResultSection
          className="px-[var(--dimension-x5)] pb-8 pt-12"
          tone="positive"
          heading="모임을 게시했어요"
          description="첫 참가자로 등록됐어요. 이제 다른 참가자를 기다려요."
        >
          <StatusBanner
            tone="positive"
            label={createdMeetup.title}
            description="서버가 생성 결과를 확인했어요."
          />
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

  const errorMessages = Object.values(errors);

  return (
    <ScreenShell bottomSpacing reserveTabBar aria-label="모임 만들기 검토">
      <TopNavigation className="sticky top-0 z-20 border-b border-[var(--stroke-neutral)] bg-[var(--bg-layer-default)]" href="/" title="모임 만들기" />
      <form className="px-[var(--dimension-x5)] pb-8 pt-5" id="create-meetup-form" noValidate onSubmit={postMeetup} aria-busy={isPosting}>
        <OfflineNotice className="mb-4" />
        <h2 className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">
          어떤 벙개를 열까요?
        </h2>
        <p className="m-0 mt-1 text-[13px] leading-5 text-[var(--fg-muted)]">
          필요한 정보만 빠르게 정하면 바로 모집을 시작해요.
        </p>

        {errorMessages.length > 0 ? (
          <StatusBanner
            className="mt-4 rounded-[12px]"
            tone="critical"
            label={`${errorMessages.length}개 항목을 확인해 주세요.`}
            description={errorMessages[0]}
          />
        ) : null}
        {mutationProblem ? <StatusBanner className="mt-4 rounded-[12px]" tone="critical" label="게시하지 못했어요." description={mutationProblem} /> : null}

        <fieldset className="mt-5 space-y-3 border-0 p-0" disabled={isPosting}>
          <label className="relative block rounded-[12px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-4 py-2.5 focus-within:border-[var(--fg-neutral)] focus-within:ring-2 focus-within:ring-[var(--fg-neutral)] focus-within:ring-offset-2" htmlFor="activity">
            <span className="block text-[12px] leading-4 text-[var(--fg-muted)]">활동</span>
            <select
              className="mt-1 min-h-[28px] w-full appearance-none bg-transparent pr-8 text-[14px] font-semibold leading-5 text-[var(--fg-neutral)] outline-none"
              id="activity"
              value={values.activity}
              onChange={(event) => updateValue("activity", event.target.value)}
              aria-label="활동 선택"
            >
              <option>산책</option>
              <option>식사</option>
              <option>보드게임</option>
              <option>카페 대화</option>
            </select>
            <ChevronDown className="pointer-events-none absolute bottom-[17px] right-4 text-[var(--fg-muted)]" size={18} strokeWidth={1.8} aria-hidden="true" />
          </label>

          <TextField id="title" label="모임 제목" value={values.title} placeholder="무엇을 함께 할지 적어 주세요" error={errors.title} onChange={(value) => updateValue("title", value)} />
          <TextField id="purpose" label="한 줄 소개" value={values.purpose} placeholder="모임의 분위기와 목적을 알려 주세요" multiline onChange={(value) => updateValue("purpose", value)} />

          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-[13px] font-semibold leading-5 text-[var(--fg-neutral)]">언제 만나요?</legend>
            <div className="grid grid-cols-2 gap-2">
              <TimeWheelPicker id="start" label="시작" value={values.start} options={timeOptions.filter((option) => option.offsetMinutes <= 24 * 60)} error={errors.start} onChange={(value) => updateValue("start", value)} />
              <TimeWheelPicker id="end" label="종료" value={values.end} options={timeOptions} error={errors.end} onChange={(value) => updateValue("end", value)} />
            </div>
          </fieldset>

          <section aria-label="서버 장소 검색" className="space-y-2">
            <TextField id="provider-place-query" label="장소 검색" value={placeQuery} placeholder="장소명 또는 주소" onChange={(value) => { placeSearchGenerationRef.current += 1; setPlaceQuery(value); setProviderPlace(null); setPublicPlaceConfirmed(false); setPlaceResults([]); setPlaceSearchProblem(null); setIsSearchingPlaces(false); }} />
            <button type="button" onClick={searchProviderPlaces} disabled={isSearchingPlaces || !placeQuery.trim() || !online} className="min-h-10 rounded-[12px] border border-[var(--stroke-neutral)] px-3 text-[14px] font-semibold disabled:opacity-50">
              {isSearchingPlaces ? "장소 검색 중…" : "서버 장소 검색"}
            </button>
            {placeSearchProblem ? <StatusBanner tone="critical" label="장소를 선택하지 못했어요." description={placeSearchProblem} /> : null}
            {placeResults.length > 0 ? <div role="radiogroup" aria-label="서버 장소 검색 결과">{placeResults.map((place) => (
              <label key={place.providerPlaceId} className="flex gap-2 border-b border-[var(--stroke-neutral)] py-2">
                <input type="radio" name="provider-place" checked={providerPlace?.providerPlaceId === place.providerPlaceId} onChange={() => { setProviderPlace(place); setPublicPlaceConfirmed(false); }} />
                <span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]"><strong>{place.name}</strong><br />{place.category} · {place.roadAddress || place.address}</span>
              </label>
            ))}</div> : null}
            {providerPlace ? <><StatusBanner tone="positive" label={providerPlace.name} description={`${providerPlace.category} · ${providerPlace.roadAddress || providerPlace.address}`} /><label className="flex gap-2 text-[13px]"><input type="checkbox" checked={publicPlaceConfirmed} onChange={(event) => setPublicPlaceConfirmed(event.target.checked)} />누구나 접근할 수 있는 공개 장소임을 확인했어요.</label></> : null}
          </section>
          <fieldset className="m-0 border-0 p-0">
            <legend className="mb-2 text-[13px] font-semibold leading-5 text-[var(--fg-neutral)]">몇 명이 모이면 시작할까요?</legend>
            <div className="grid grid-cols-2 gap-2">
              <NumberField id="minimum" label="최소 성사 인원" value={values.minimum} error={errors.minimum} onChange={(value) => updateValue("minimum", value)} />
              <NumberField id="capacity" label="정원" value={values.capacity} error={errors.capacity} onChange={(value) => updateValue("capacity", value)} />
            </div>
        </fieldset>

          <TextField id="costAlcohol" label="비용·음주" value={values.costAlcohol} placeholder="예: 무료 · 음주 없음" onChange={(value) => updateValue("costAlcohol", value)} />
          <TextField id="preparation" label="준비물" value={values.preparation} placeholder="없으면 비워 두세요" multiline onChange={(value) => updateValue("preparation", value)} />
          <TextField id="facilitationTemplate" label="진행 방식" value={values.facilitationTemplate} placeholder="예: 자유 진행" error={errors.facilitationTemplate} onChange={(value) => updateValue("facilitationTemplate", value)} />
        </fieldset>

        <StatusBanner className="mt-4 rounded-[12px]" tone="positive" label="만들면 바로 첫 참가자 1명으로 시작해요." />

        <ul className="m-0 mt-4 list-none space-y-2 p-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
          <li>· 생성 시점부터 24시간 안에 시작해요</li>
          <li>· 비공개 장소는 등록할 수 없어요</li>
          <li>· 미달 시 제안자가 진행 또는 취소를 결정해요</li>
        </ul>
      </form>

      <BottomActionBar>
        <button
          className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          form="create-meetup-form"
          disabled={isPosting || !online}
        >
          {isPosting ? "게시 중…" : "모임 만들기"}
        </button>
      </BottomActionBar>
    </ScreenShell>
  );
}

export default function NewMeetupPage() {
  return <NewMeetupPageContent />;
}
