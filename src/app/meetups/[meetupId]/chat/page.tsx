"use client";

import {
  ChevronRight,
  ListChecks,
  MoreHorizontal,
  Paperclip,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import { FormEvent, useEffect, useRef, useState } from "react";

import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";

type ChatMessage = {
  id: string;
  sender: string;
  initials: string;
  text: string;
  mine?: boolean;
  reveal?: boolean;
};

const initialMessages: ChatMessage[] = [
  {
    id: "minji-1",
    sender: "민지",
    initials: "민",
    text: "안녕하세요! 7시에 합정역 3번 출구 앞에서 만나요.",
  },
  {
    id: "jimin-1",
    sender: "지민",
    initials: "지",
    text: "좋아요. 저는 간단한 게임 하나 준비해 갈게요.",
  },
  {
    id: "me-1",
    sender: "나",
    initials: "나",
    text: "넵, 6시 50분쯤 도착할게요!",
    mine: true,
  },
];

export default function MeetupChatPage() {
  const reduceMotion = useReducedMotion();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideTargeted, setGuideTargeted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const guideRef = useRef<HTMLElement>(null);
  const canSendMessage = draft.trim().length > 0;

  useEffect(() => {
    const openGuideFromHash = () => {
      const targeted = window.location.hash === "#guide";
      setGuideTargeted(targeted);
      if (targeted) {
        setGuideOpen(true);
      }
    };

    openGuideFromHash();
    window.addEventListener("hashchange", openGuideFromHash);
    return () => window.removeEventListener("hashchange", openGuideFromHash);
  }, []);

  useEffect(() => {
    if (guideOpen && guideTargeted) {
      guideRef.current?.focus({ preventScroll: true });
      guideRef.current?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "nearest",
      });
    }
  }, [guideOpen, guideTargeted, reduceMotion]);

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    setMessages((current) => [
      ...current,
      {
        id: `message-${Date.now()}`,
        sender: "나",
        initials: "나",
        text,
        mine: true,
        reveal: true,
      },
    ]);
    setDraft("");
    setStatusMessage("메시지를 보냈어요.");
  };

  const toggleGuide = () => {
    if (guideOpen && window.location.hash === "#guide") {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
      setGuideTargeted(false);
    }
    setGuideOpen((open) => !open);
  };

  return (
    <ScreenShell className="min-h-[100svh]">
      <TopNavigation
        href="/"
        title={
          <span className="flex min-w-0 flex-col">
            <span className="font-display truncate text-[length:var(--type-page-title)] font-normal leading-6 text-[var(--fg-neutral)]">합정 보드게임</span>
            <span className="truncate text-[length:var(--type-meta)] font-normal leading-4 text-[var(--fg-muted)]">오늘 19:00 · 4명 참여</span>
          </span>
        }
        trailing={
          <button
            type="button"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-[var(--fg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            aria-label="채팅 메뉴 열기"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreHorizontal size={24} strokeWidth={1.8} aria-hidden="true" />
          </button>
        }
        className="border-b border-[var(--stroke-neutral)] px-4"
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <section className="shrink-0 px-4 pt-3" aria-label="그룹 채팅 안전 안내">
          <div className="flex items-center gap-3 bg-[var(--bg-layer-floating)] px-4 py-3">
            <ShieldCheck className="shrink-0 text-[var(--fg-neutral)]" size={24} strokeWidth={1.8} aria-hidden="true" />
            <p className="m-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)]">확정 참가자만 볼 수 있는 그룹 채팅이에요.</p>
          </div>
          {menuOpen ? (
            <div className="border-t border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-4 py-3 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
              채팅에서 연락처를 요구하거나 불편한 말을 받았다면 메시지에서 신고할 수 있어요.
            </div>
          ) : null}
        </section>

        <section className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-5" aria-label="합정 보드게임 메시지">
          <p className="mb-4 text-center text-[length:var(--type-meta)] leading-4 text-[var(--fg-muted)]">오늘</p>
          <ol className="m-0 flex list-none flex-col gap-4 p-0">
            {messages.map((message) => (
              <li key={message.id} className={`flex items-end gap-2 ${message.mine ? "justify-end" : "justify-start"}`}>
                {!message.mine ? (
                  <span
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-[length:var(--type-section)] font-bold text-[var(--fg-neutral)]"
                    aria-hidden="true"
                  >
                    {message.initials}
                  </span>
                ) : null}
                <div className={`flex max-w-[78%] flex-col ${message.mine ? "items-end" : "items-start"}`}>
                  {!message.mine ? <span className="mb-1 px-1 text-[length:var(--type-meta)] leading-4 text-[var(--fg-muted)]">{message.sender}</span> : null}
                  <p
                    className={`m-0 w-fit max-w-[224px] whitespace-pre-wrap px-4 py-2 text-[length:var(--type-body)] leading-[22px] ${message.mine ? "rounded-2xl bg-[var(--brand-accent)] text-[var(--fg-on-brand)]" : "rounded-2xl bg-[var(--bg-layer-floating)] text-[var(--fg-neutral)]"} ${message.reveal ? "chat-content-reveal" : ""}`}
                  >
                    {message.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <footer className="mb-[144px] shrink-0 space-y-2 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2">
          {guideOpen ? (
            <section
              ref={guideRef}
              id="guide"
              tabIndex={-1}
              className="chat-content-reveal border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-4 py-3 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              aria-label="첫 10분 진행 가이드"
            >
              <h2 className="m-0 text-[length:var(--type-section)] font-bold leading-6 text-[var(--fg-neutral)]">첫 10분 진행 가이드</h2>
              <ol className="m-0 mt-2 list-decimal space-y-1 pl-5 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
                <li>서로의 이름과 오늘 기대하는 것을 짧게 소개해요.</li>
                <li>첫 게임을 정하고 종료 시각을 함께 확인해요.</li>
              </ol>
            </section>
          ) : null}
          <button
            type="button"
            className="flex min-h-[52px] w-full items-center gap-3 bg-[var(--bg-layer-floating)] px-4 text-left focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            aria-expanded={guideOpen}
            onClick={toggleGuide}
          >
            <ListChecks className="shrink-0 text-[var(--fg-neutral)]" size={24} strokeWidth={1.8} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[length:var(--type-action)] leading-6 text-[var(--fg-neutral)]">첫 10분 진행 가이드</span>
              <span className="block text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">처음 만나도 어색하지 않게 시작해요</span>
            </span>
            <ChevronRight className={`shrink-0 text-[var(--fg-muted)] transition-transform ${guideOpen ? "rotate-90" : ""}`} size={22} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <form className="flex items-center gap-3" onSubmit={sendMessage}>
            <label className="flex min-h-[52px] min-w-0 flex-1 items-center gap-3 rounded-full bg-[var(--bg-layer-floating)] px-4 text-[var(--fg-muted)] focus-within:outline-2 focus-within:outline-[var(--fg-neutral)] focus-within:outline-offset-2">
              <Paperclip className="shrink-0" size={24} strokeWidth={1.8} aria-hidden="true" />
              <span className="sr-only">메시지</span>
              <input
                className="min-h-[44px] min-w-0 flex-1 border-0 bg-transparent p-0 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-neutral)] outline-none placeholder:text-[var(--fg-muted)]"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="메시지 보내기"
                aria-label="메시지 입력"
              />
            </label>
            <button
              type="submit"
              disabled={!canSendMessage}
              className="inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="메시지 보내기"
            >
              <Send size={23} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </form>
        </footer>
      </div>
      <p className="sr-only" aria-live="polite">
        {statusMessage}
      </p>
    </ScreenShell>
  );
}
