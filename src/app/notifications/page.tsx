"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  MessageCircle,
  Megaphone,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { BottomNavigation } from "@/components/bottom-navigation";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  time: string;
  icon: LucideIcon;
  tone: "critical" | "neutral" | "positive" | "muted";
  href: string;
};

const notificationItems: NotificationItem[] = [
  {
    id: "meetup-cancelled",
    title: "한강 산책 · 8/28 18:30 취소",
    body: "출석 신뢰와 참여 기록에 영향이 없어요",
    time: "방금",
    icon: AlertTriangle,
    tone: "critical",
    href: "/meetups/han-river-walk",
  },
  {
    id: "check-in-choice",
    title: "한강 산책 · 8/28 19:00",
    body: "체크인 전까지 참여 여부를 선택할 수 있어요",
    time: "1시간 전",
    icon: UserRound,
    tone: "neutral",
    href: "/meetups/han-river-walk",
  },
  {
    id: "quorum-met",
    title: "합정 보드게임 · 8/28 18:30",
    body: "현재 3명 · 정원 4명 · 오늘 18:30 시작",
    time: "어제",
    icon: Check,
    tone: "positive",
    href: "/meetups/hapjeong-board-games",
  },
  {
    id: "safety-update",
    title: "안전 신고 처리 상태가 업데이트됐어요",
    body: "접수 상태를 안전하게 확인할 수 있어요",
    time: "2일 전",
    icon: ShieldCheck,
    tone: "muted",
    href: "/profile",
  },
  {
    id: "connection-created",
    title: "한강 산책 · 8/28 18:30 연결",
    body: "이제 1:1 대화를 시작할 수 있어요",
    time: "3일 전",
    icon: MessageCircle,
    tone: "muted",
    href: "/connections",
  },
];

const toneClasses: Record<NotificationItem["tone"], string> = {
  critical: "text-[var(--fg-critical)]",
  neutral: "text-[var(--fg-muted)]",
  positive: "text-[var(--fg-positive)]",
  muted: "text-[var(--fg-muted)]",
};

export default function NotificationsPage() {
  const [readIds, setReadIds] = useState<string[]>(() => notificationItems.slice(2).map(({ id }) => id));
  const [statusMessage, setStatusMessage] = useState("");

  const unreadCount = notificationItems.length - readIds.length;

  const markAsRead = (id: string) => {
    setReadIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  const markAllAsRead = () => {
    if (unreadCount === 0) return;
    setReadIds(notificationItems.map(({ id }) => id));
    setStatusMessage("모든 알림을 읽었어요.");
  };

  return (
    <main className="app-viewport">
      <div className="home-shell">
        <header className="flex min-h-[92px] shrink-0 items-start justify-between px-5 pt-7">
          <h1
            className="font-display m-0 text-[length:var(--type-page-title)] font-normal leading-6 tracking-[-0.04em] text-[var(--fg-neutral)]"
          >
            알림
          </h1>
          <button
            type="button"
            className="mt-1 inline-flex min-h-[44px] items-center px-1 text-[length:var(--type-action)] leading-6 text-[var(--fg-neutral)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2 disabled:cursor-default disabled:text-[var(--fg-muted)] disabled:no-underline"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            aria-label={unreadCount === 0 ? "모든 알림을 읽었어요" : "모든 알림 읽기"}
          >
            모두 읽기
          </button>
        </header>

        <div className="flex-1 px-5 pb-[100px]">
          <section aria-labelledby="activity-title">
            <h2
              id="activity-title"
              className="font-display mb-3 text-[length:var(--type-section)] font-normal leading-6 text-[var(--fg-neutral)]"
            >
              모임 활동
            </h2>
            <ul className="m-0 list-none p-0">
              {notificationItems.map((item) => {
                const isRead = readIds.includes(item.id);
                const Icon = item.icon;

                return (
                  <li key={item.id} className="border-b border-[var(--stroke-neutral)]">
                    <Link
                      href={item.href}
                      onClick={() => markAsRead(item.id)}
                      className="group flex min-h-[74px] w-full items-start gap-3 py-3 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-[-2px]"
                      aria-label={`${item.title}. ${item.body}. ${isRead ? "읽음" : "읽지 않음"}`}
                    >
                      <Icon
                        className={`mt-1 shrink-0 ${toneClasses[item.tone]}`}
                        size={22}
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-[length:var(--type-title)] leading-5 text-[var(--fg-neutral)] ${isRead ? "font-normal" : "font-bold"}`}
                        >
                          {!isRead ? (
                            <span className="mr-1" aria-hidden="true">
                              •
                            </span>
                          ) : null}
                          {item.title}
                        </span>
                        <span className="mt-1 block text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
                          {item.body}
                        </span>
                      </span>
                      <time className="mt-1 shrink-0 text-[length:var(--type-meta)] leading-4 text-[var(--fg-muted)]" dateTime="2026-08-28">
                        {item.time}
                      </time>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mt-7" aria-labelledby="notification-settings-title">
            <h2
              id="notification-settings-title"
              className="font-display mb-3 text-[length:var(--type-section)] font-normal leading-6 text-[var(--fg-neutral)]"
            >
              알림 설정
            </h2>
            <Link
              href="/profile"
              className="flex min-h-[68px] w-full items-center gap-3 border-b border-[var(--stroke-neutral)] py-2 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-[-2px]"
              aria-label="마케팅 알림 관리. 별도 동의가 필요해요"
            >
              <Megaphone className="shrink-0 text-[var(--fg-muted)]" size={22} strokeWidth={1.8} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-[length:var(--type-title)] leading-5 text-[var(--fg-neutral)]">마케팅 알림 관리</span>
                <span className="mt-1 block text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">별도 동의가 필요해요</span>
              </span>
              <ChevronRight className="shrink-0 text-[var(--fg-muted)]" size={22} strokeWidth={1.8} aria-hidden="true" />
            </Link>
            <p className="m-0 pt-2 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
              알림 미리보기에는 정확한 주소와 신고자 정보를 표시하지 않아요.
            </p>
          </section>
        </div>

        <p className="sr-only" aria-live="polite">
          {statusMessage}
        </p>
        <BottomNavigation activeTab="notifications" />
      </div>
    </main>
  );
}
