"use client";

import {
  Ban,
  CircleCheck,
  Flag,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  AnimatedDialog,
  AnimatedDialogClose,
  AnimatedDialogDescription,
  AnimatedDialogTitle,
} from "@/components/animated-dialog";
import { BottomActionBar } from "@/components/bottom-action-bar";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";

const meetupDetails = [
  { label: "시간", value: "오늘 18:30–20:00" },
  { label: "인원", value: "현재 2명 · 최소 3명 · 정원 6명" },
  { label: "비용", value: "무료" },
  { label: "음주", value: "없음" },
  { label: "진행", value: "20분 산책 후 카페 선택" },
];

const reportReasons = [
  ["unsafe", "안전 위협"],
  ["harassment", "괴롭힘·혐오"],
  ["sexual", "성적 접근·데이트 목적 위장"],
  ["solicitation", "영업·종교·다단계 권유"],
  ["privacy", "개인정보 침해"],
  ["misleading", "허위 장소·목적"],
  ["attendance", "노쇼·반복 지각"],
  ["other", "기타"],
] as const;

export default function MeetupDetailPage() {
  const params = useParams<{ meetupId: string }>();
  const meetupId = typeof params.meetupId === "string" ? params.meetupId : "han-river-walk";
  const encodedMeetupId = encodeURIComponent(meetupId);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetail, setReportDetail] = useState("");
  const [urgentReport, setUrgentReport] = useState(false);
  const [reported, setReported] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const reportTriggerRef = useRef<HTMLButtonElement>(null);
  const blockTriggerRef = useRef<HTMLButtonElement>(null);
  const reportCommitRequested = useRef(false);
  const blockCommitRequested = useRef(false);
  const reportWasOpened = useRef(false);
  const blockWasOpened = useRef(false);

  useEffect(() => {
    if (reported) {
      document.getElementById("meetup-report-receipt")?.focus();
    }
  }, [reported]);

  useEffect(() => {
    if (blocked) {
      document.getElementById("meetup-blocked-result")?.focus();
    }
  }, [blocked]);

  function openReportDialog() {
    reportWasOpened.current = true;
    setReportOpen(true);
  }

  function handleReportOpenChange(open: boolean) {
    if (open) reportWasOpened.current = true;
    setReportOpen(open);
  }

  function handleReportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reportReason || reportCommitRequested.current) return;

    reportCommitRequested.current = true;
    setReportOpen(false);
  }

  function handleReportExitComplete() {
    if (reportCommitRequested.current) {
      reportCommitRequested.current = false;
      reportWasOpened.current = false;
      setReported(true);
      return;
    }

    if (reportWasOpened.current) {
      reportWasOpened.current = false;
      reportTriggerRef.current?.focus();
    }
  }

  function openBlockDialog() {
    blockWasOpened.current = true;
    setBlockOpen(true);
  }

  function handleBlockOpenChange(open: boolean) {
    if (open) blockWasOpened.current = true;
    setBlockOpen(open);
  }

  function confirmBlock() {
    if (!blockOpen || blockCommitRequested.current) return;

    blockCommitRequested.current = true;
    setBlockOpen(false);
  }

  function handleBlockExitComplete() {
    if (blockCommitRequested.current) {
      blockCommitRequested.current = false;
      blockWasOpened.current = false;
      setBlocked(true);
      return;
    }

    if (blockWasOpened.current) {
      blockWasOpened.current = false;
      blockTriggerRef.current?.focus();
    }
  }

  return (
    <ScreenShell bottomSpacing aria-label="모임 상세">
      <TopNavigation
        href="/"
        title="모임 상세"
      />

      {blocked ? (
        <section
          className="flex flex-1 flex-col items-center px-[var(--dimension-x5)] pt-28 text-center"
          aria-labelledby="meetup-blocked-heading"
          id="meetup-blocked-result"
          tabIndex={-1}
        >
          <div
            className="flex size-[72px] items-center justify-center rounded-full bg-[var(--bg-neutral-weak)] text-[var(--fg-muted)]"
            aria-hidden="true"
          >
            <Ban size={30} strokeWidth={1.8} />
          </div>
          <h2
            id="meetup-blocked-heading"
            className="m-0 mt-5 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]"
          >
            제안자를 차단했어요
          </h2>
          <p className="m-0 mt-3 max-w-[320px] text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
            차단 관계로 이 모임 정보와 참여 기능을 숨겼어요.
          </p>
        </section>
      ) : (
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

          <section className="mt-4 border-t border-[var(--stroke-neutral)] pt-5" aria-labelledby="meetup-safety-heading">
            <h3
              id="meetup-safety-heading"
              className="m-0 text-[length:var(--type-section)] font-semibold leading-6 text-[var(--fg-neutral)]"
            >
              안전 도움이 필요한가요?
            </h3>
            <p className="m-0 mt-2 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
              불편하거나 위험한 상황을 신고하거나 모임 제안자를 차단할 수 있어요.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                ref={reportTriggerRef}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-[10px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-3 text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-critical)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                type="button"
                onClick={openReportDialog}
                aria-haspopup="dialog"
                aria-expanded={reportOpen}
              >
                <Flag size={19} strokeWidth={1.8} aria-hidden="true" />
                신고하기
              </button>
              <button
                ref={blockTriggerRef}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-[10px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-3 text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-critical)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                type="button"
                onClick={openBlockDialog}
                aria-haspopup="dialog"
                aria-expanded={blockOpen}
              >
                <Ban size={19} strokeWidth={1.8} aria-hidden="true" />
                제안자 차단
              </button>
            </div>
            {reported ? (
              <div
                className="mt-4 flex items-start gap-2 rounded-[10px] bg-[var(--bg-neutral-weak)] px-3 py-3 text-left"
                id="meetup-report-receipt"
                role="status"
                aria-live="polite"
                tabIndex={-1}
              >
                <ShieldCheck className="mt-0.5 shrink-0 text-[var(--fg-critical)]" size={18} strokeWidth={1.8} aria-hidden="true" />
                <p className="m-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)]">
                  신고 내용을 이 화면에 기록했어요. 운영 검토 결과가 확정된 것은 아니에요.
                </p>
              </div>
            ) : null}
          </section>
        </div>
      )}

      <AnimatedDialog
        open={reportOpen}
        onOpenChange={handleReportOpenChange}
        onExitComplete={handleReportExitComplete}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <AnimatedDialogTitle className="m-0 text-[length:var(--type-section)] font-semibold leading-6 text-[var(--fg-neutral)]">
          이 모임을 신고할까요?
        </AnimatedDialogTitle>
        <AnimatedDialogDescription className="m-0 mt-2 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
          신고 사유와 필요한 경우 상세 내용을 남겨 주세요.
        </AnimatedDialogDescription>
        <form className="mt-4" onSubmit={handleReportSubmit}>
          <fieldset className="m-0 border-0 p-0">
            <legend className="sr-only">신고 사유</legend>
            <div className="space-y-1">
              {reportReasons.map(([value, label]) => (
                <label
                  className="flex min-h-[44px] items-center gap-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)]"
                  key={value}
                >
                  <input
                    className="size-5 accent-[var(--fg-neutral)]"
                    type="radio"
                    name="meetup-report-reason"
                    value={value}
                    checked={reportReason === value}
                    onChange={(event) => setReportReason(event.target.value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="mt-3 flex min-h-[44px] items-center gap-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)]">
            <input
              className="size-5 accent-[var(--fg-critical)]"
              type="checkbox"
              checked={urgentReport}
              onChange={(event) => setUrgentReport(event.target.checked)}
            />
            긴급한 안전 위협이에요
          </label>
          <p className="m-0 mt-2 text-[12px] leading-4 text-[var(--fg-muted)]">
            신고자 정보는 상대에게 공개되지 않아요. 즉시 위험하면{" "}
            <a className="font-semibold text-[var(--fg-critical)] underline" href="tel:112">112</a>
            {" 또는 "}<a className="font-semibold text-[var(--fg-critical)] underline" href="tel:119">119</a>에 연락하세요.
          </p>
          <label
            className="mt-3 block text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)]"
            htmlFor="meetup-report-detail"
          >
            상세 내용 (선택)
          </label>
          <textarea
            id="meetup-report-detail"
            className="mt-2 min-h-[80px] w-full resize-y rounded-[10px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] p-3 text-[length:var(--type-body)] leading-[22px] outline-none focus-visible:border-[var(--fg-neutral)] focus-visible:ring-2 focus-visible:ring-[var(--fg-neutral)]"
            value={reportDetail}
            onChange={(event) => setReportDetail(event.target.value)}
            placeholder="상황을 알려 주세요."
          />
          <div className="mt-3 flex gap-2">
            <button
              className="min-h-[48px] flex-1 rounded-[10px] bg-[var(--fg-critical)] px-4 text-[length:var(--type-action)] font-semibold leading-6 text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              type="submit"
              disabled={!reportReason}
            >
              신고 내용 기록하기
            </button>
            <AnimatedDialogClose asChild>
              <button
                className="min-h-[48px] rounded-[10px] px-4 text-[length:var(--type-action)] leading-6 text-[var(--fg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                type="button"
              >
                취소
              </button>
            </AnimatedDialogClose>
          </div>
        </form>
      </AnimatedDialog>

      <AnimatedDialog
        open={blockOpen}
        onOpenChange={handleBlockOpenChange}
        onExitComplete={handleBlockExitComplete}
        onCloseAutoFocus={(event) => event.preventDefault()}
        className="border border-[var(--fg-critical)] bg-[var(--bg-critical-weak)]"
      >
        <AnimatedDialogTitle className="m-0 text-[length:var(--type-section)] font-semibold leading-6 text-[var(--fg-critical)]">
          모임 제안자를 차단할까요?
        </AnimatedDialogTitle>
        <AnimatedDialogDescription className="m-0 mt-2 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)]">
          제안자를 차단하면 서로의 프로필·모임·연결이 숨겨지고, 이 모임에도 참여할 수 없어요.
        </AnimatedDialogDescription>
        <div className="mt-3 flex gap-2">
          <button
            className="min-h-[48px] flex-1 rounded-[10px] bg-[var(--fg-critical)] px-4 text-[length:var(--type-action)] font-semibold leading-6 text-white focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            type="button"
            onClick={confirmBlock}
          >
            제안자 차단하기
          </button>
          <AnimatedDialogClose asChild>
            <button
              className="min-h-[48px] rounded-[10px] px-4 text-[length:var(--type-action)] leading-6 text-[var(--fg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              type="button"
            >
              취소
            </button>
          </AnimatedDialogClose>
        </div>
      </AnimatedDialog>

      {blocked ? null : (
        <BottomActionBar>
          <Link
            className="inline-flex min-h-[var(--action-primary-height)] w-full items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-bold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            href={`/meetups/${encodedMeetupId}/join`}
          >
            이 모임에 참여하기
          </Link>
        </BottomActionBar>
      )}
    </ScreenShell>
  );
}
