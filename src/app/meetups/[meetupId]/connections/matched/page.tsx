"use client";

import { Ban, Flag, MessageCircle, Send, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";

export default function MatchedConnectionPage() {
  const params = useParams<{ meetupId: string }>();
  const meetupId = typeof params.meetupId === "string" ? params.meetupId : "han-river-walk";
  const meetupHref = `/meetups/${encodeURIComponent(meetupId)}`;
  const [chatOpen, setChatOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messageSent, setMessageSent] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetail, setReportDetail] = useState("");
  const [reported, setReported] = useState(false);
  const [blockConfirm, setBlockConfirm] = useState(false);
  const [blocked, setBlocked] = useState(false);

  function handleMessageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) return;
    setMessageSent(true);
    setMessage("");
  }

  function handleReportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reportReason) return;
    setReported(true);
    setReportOpen(false);
  }

  function confirmBlock() {
    setBlocked(true);
    setBlockConfirm(false);
    setChatOpen(false);
  }

  return (
    <ScreenShell bottomSpacing>
      <TopNavigation
        href={meetupHref}
        title={<span className="font-display text-[length:var(--type-page-title)] font-normal leading-6">상호 연결</span>}
      />

      {blocked ? (
        <section className="flex flex-1 flex-col items-center px-5 pt-28 text-center" aria-labelledby="blocked-heading">
          <div className="flex size-[72px] items-center justify-center rounded-full bg-[var(--bg-neutral-weak)] text-[var(--fg-muted)]" aria-hidden="true">
            <Ban size={30} strokeWidth={1.8} />
          </div>
          <h2 id="blocked-heading" className="mt-5 font-display text-[length:var(--type-headline)] font-normal leading-8 tracking-[-0.02em]">
            연결을 종료했어요
          </h2>
          <p className="mt-4 max-w-[330px] text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
            상대방의 프로필과 모임, 연결이 서로에게 숨겨져요. 긴급한 안전 문제는 별도로 신고해 주세요.
          </p>
        </section>
      ) : (
        <div className="flex flex-1 flex-col px-5 pb-8">
          <section className="mt-16 flex flex-col items-center text-center" aria-labelledby="matched-heading">
            <div className="flex size-[72px] items-center justify-center rounded-full bg-[var(--bg-positive-weak)] text-[var(--fg-positive)]" aria-hidden="true">
              <MessageCircle size={34} strokeWidth={1.8} />
            </div>
            <h2 id="matched-heading" className="mt-5 font-display text-[length:var(--type-headline)] font-normal leading-8 tracking-[-0.03em]">
              지민님과 연결됐어요
            </h2>
            <p className="mt-4 max-w-[335px] text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
              이제 1:1 대화를 시작할 수 있어요. 연결 전에는 누구도 내 선택을 알 수 없었어요.
            </p>
          </section>

          <blockquote className="m-0 mt-6 rounded-2xl bg-[var(--bg-neutral-weak)] px-4 py-4">
            <p className="m-0 text-[length:var(--type-section)] font-semibold leading-6 text-[var(--fg-neutral)]">퇴근 후 한강 산책에서 만났어요</p>
            <p className="m-0 mt-3 text-[length:var(--type-section)] font-semibold leading-6 text-[var(--fg-neutral)]">
              “오늘 즐거웠어요. 다음에도 산책할까요?”
            </p>
          </blockquote>

          <section className="mt-7 border-t border-[var(--stroke-neutral)] pt-5" aria-labelledby="safety-heading">
            <h3 id="safety-heading" className="m-0 text-[length:var(--type-section)] font-semibold leading-6 text-[var(--fg-neutral)]">연결 이후에도 신고·차단할 수 있어요</h3>
            <p className="m-0 mt-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
              차단하면 프로필·모임·연결이 즉시 서로에게 숨겨지고 이 연결은 종료돼요.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                className="flex min-h-[48px] items-center justify-center gap-2 border border-[var(--stroke-neutral)] px-3 text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-critical)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                type="button"
                onClick={() => setReportOpen((current) => !current)}
                aria-expanded={reportOpen}
              >
                <Flag size={19} strokeWidth={1.8} aria-hidden="true" />
                신고하기
              </button>
              <button
                className="flex min-h-[48px] items-center justify-center gap-2 border border-[var(--stroke-neutral)] px-3 text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-critical)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                type="button"
                onClick={() => setBlockConfirm(true)}
                aria-expanded={blockConfirm}
              >
                <Ban size={19} strokeWidth={1.8} aria-hidden="true" />
                차단하기
              </button>
            </div>
          </section>

          {chatOpen ? (
            <section className="mt-5 border-t border-[var(--stroke-neutral)] pt-5" aria-labelledby="chat-heading">
              <h3 id="chat-heading" className="m-0 text-[length:var(--type-section)] font-semibold leading-6">지민님에게 메시지 보내기</h3>
              <form className="mt-3" onSubmit={handleMessageSubmit}>
                <label className="sr-only" htmlFor="connection-message">메시지</label>
                <textarea
                  id="connection-message"
                  className="min-h-[88px] w-full resize-y border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] p-3 text-[length:var(--type-body)] leading-[22px] outline-none focus-visible:border-[var(--fg-neutral)] focus-visible:ring-2 focus-visible:ring-[var(--fg-neutral)]"
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    setMessageSent(false);
                  }}
                  placeholder="가볍게 인사를 건네 보세요."
                />
                <button
                  className="mt-2 inline-flex min-h-[48px] items-center justify-center gap-2 border border-[var(--stroke-neutral)] px-4 text-[length:var(--type-action)] font-semibold leading-6 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                  type="submit"
                  disabled={!message.trim()}
                >
                  <Send size={18} strokeWidth={1.8} aria-hidden="true" />
                  보내기
                </button>
              </form>
              {messageSent ? <p className="m-0 mt-2 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-positive)]" role="status">메시지를 보냈어요.</p> : null}
            </section>
          ) : null}

          {reportOpen ? (
            <form className="mt-5 border-t border-[var(--stroke-neutral)] pt-5" onSubmit={handleReportSubmit} aria-labelledby="report-heading">
              <h3 id="report-heading" className="m-0 text-[length:var(--type-section)] font-semibold leading-6">연결 신고하기</h3>
              <fieldset className="mt-3 m-0 border-0 p-0">
                <legend className="text-[length:var(--type-body)] leading-[22px]">신고 사유를 선택해 주세요.</legend>
                <div className="mt-2 space-y-1">
                  {[
                    ["harassment", "괴롭힘·혐오"],
                    ["sexual", "성적 접근"],
                    ["privacy", "개인정보 침해"],
                    ["other", "기타"],
                  ].map(([value, label]) => (
                    <label key={value} className="flex min-h-[44px] items-center gap-3 text-[length:var(--type-body)] leading-[22px]">
                      <input
                        className="size-5 accent-[var(--fg-neutral)]"
                        type="radio"
                        name="connection-report-reason"
                        value={value}
                        checked={reportReason === value}
                        onChange={(event) => setReportReason(event.target.value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="mt-3 block text-[length:var(--type-body)] leading-[22px]" htmlFor="connection-report-detail">상세 내용 (선택)</label>
              <textarea
                id="connection-report-detail"
                className="mt-2 min-h-[80px] w-full resize-y border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] p-3 text-[length:var(--type-body)] leading-[22px] outline-none focus-visible:border-[var(--fg-neutral)] focus-visible:ring-2 focus-visible:ring-[var(--fg-neutral)]"
                value={reportDetail}
                onChange={(event) => setReportDetail(event.target.value)}
                placeholder="상황을 알려 주세요."
              />
              <button
                  className="mt-2 min-h-[48px] border border-[var(--fg-critical)] px-4 text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-critical)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                type="submit"
                disabled={!reportReason}
              >
                신고 접수하기
              </button>
            </form>
          ) : null}

          {blockConfirm ? (
            <div className="mt-5 border border-[var(--fg-critical)] bg-[var(--bg-critical-weak)] px-4 py-4" role="alertdialog" aria-labelledby="block-heading" aria-describedby="block-description">
              <h3 id="block-heading" className="m-0 text-[length:var(--type-section)] font-semibold leading-6 text-[var(--fg-critical)]">이 연결을 차단할까요?</h3>
              <p id="block-description" className="m-0 mt-2 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)]">차단하면 서로의 프로필·모임·연결이 숨겨지고 대화가 종료돼요.</p>
              <div className="mt-3 flex gap-2">
                <button
                  className="min-h-[48px] bg-[var(--fg-critical)] px-4 text-[length:var(--type-action)] font-semibold leading-6 text-white focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                  type="button"
                  onClick={confirmBlock}
                >
                  차단하기
                </button>
                <button
                  className="min-h-[48px] px-4 text-[length:var(--type-action)] leading-6 text-[var(--fg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                  type="button"
                  onClick={() => setBlockConfirm(false)}
                >
                  취소
                </button>
              </div>
            </div>
          ) : null}

          {reported ? (
            <p className="mt-4 flex items-center gap-2 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-critical)]" role="status" aria-live="polite">
              <ShieldCheck size={18} strokeWidth={1.8} aria-hidden="true" />
              신고를 접수했어요. 처리 상태는 알림으로 안내해요.
            </p>
          ) : null}
        </div>
      )}

      <BottomActionBar>
        {blocked ? (
          <button
            className="flex min-h-[52px] w-full items-center justify-center bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            type="button"
            onClick={() => window.history.back()}
          >
            확인했어요
          </button>
        ) : (
          <button
            className="flex min-h-[52px] w-full items-center justify-center bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            type="button"
            onClick={() => setChatOpen(true)}
          >
            {chatOpen ? "1:1 대화 계속하기" : "1:1 대화 시작하기"}
          </button>
        )}
      </BottomActionBar>
    </ScreenShell>
  );
}
