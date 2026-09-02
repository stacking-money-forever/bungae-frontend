"use client";

import Link from "next/link";
import {
  Ban,
  Bell,
  BadgeCheck,
  ChevronRight,
  Clock3,
  Heart,
  Link2,
  LogOut,
  MapPin,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState, type ButtonHTMLAttributes, type FormEvent, type Ref } from "react";

import {
  AnimatedDialog,
  AnimatedDialogClose,
  AnimatedDialogDescription,
  AnimatedDialogTitle,
} from "@/components/animated-dialog";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";

type ProfileRowProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "title"> & {
  icon: LucideIcon;
  title: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  muted?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

function ProfileRow({
  icon: Icon,
  title,
  description,
  href,
  onClick,
  muted = false,
  ref,
  ...buttonProps
}: ProfileRowProps) {
  const content = (
    <>
      <Icon className={`shrink-0 ${muted ? "text-[var(--fg-muted)]" : "text-[var(--fg-neutral)]"}`} size={25} strokeWidth={1.8} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className={`block text-[14px] font-medium leading-5 ${muted ? "text-[var(--fg-muted)]" : "text-[var(--fg-neutral)]"}`}>{title}</span>
        {description ? <span className="block text-[11px] font-medium leading-4 text-[var(--fg-muted)]">{description}</span> : null}
      </span>
      <ChevronRight className="shrink-0 text-[var(--fg-muted)]" size={22} strokeWidth={1.8} aria-hidden="true" />
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex min-h-[44px] w-full items-center gap-3 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-[-2px]"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      {...buttonProps}
      type="button"
      className="flex min-h-[44px] w-full items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-[-2px]"
      onClick={onClick}
      ref={ref}
    >
      {content}
    </button>
  );
}

export default function ProfilePage() {
  const reduceMotion = useReducedMotion();
  const [logoutRequested, setLogoutRequested] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);
  const logoutCommitRequested = useRef(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profile, setProfile] = useState({
    name: "민지",
    interests: "산책 · 보드게임 · 카페 대화",
    area: "마포구 망원동",
    availability: "오늘 저녁",
  });

  const confirmLogout = () => {
    logoutCommitRequested.current = true;
    setLogoutRequested(false);
  };

  const commitLogoutAfterExit = () => {
    if (!logoutCommitRequested.current) return;
    logoutCommitRequested.current = false;
    setLoggedOut(true);
  };

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setProfile({
      name: String(formData.get("name")),
      interests: String(formData.get("interests")),
      area: String(formData.get("area")),
      availability: String(formData.get("availability")),
    });
    setEditingProfile(false);
  };

  return (
    <ScreenShell className="px-5 pb-8">
      <TopNavigation
        href="/"
        title={<span className="font-display text-[16px] font-normal leading-6">프로필</span>}
        trailing={
          <button
            type="button"
            onClick={() => setEditingProfile(true)}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-[var(--fg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
            aria-label="프로필 설정"
          >
            <Settings size={25} strokeWidth={1.8} aria-hidden="true" />
          </button>
        }
        className="-mx-5 px-4"
      />

      <section className="mt-3 flex min-h-[100px] items-center gap-2 rounded-2xl bg-[var(--bg-layer-floating)] px-3 py-3" aria-labelledby="profile-name">
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[18px] font-bold text-[var(--fg-on-brand)]" aria-hidden="true">민</span>
        <div className="min-w-0">
          <h1 id="profile-name" className="m-0 flex items-center gap-2 text-[16px] font-bold leading-6 text-[var(--fg-neutral)]">
            {profile.name}
            <BadgeCheck className="shrink-0 text-[var(--fg-neutral)]" size={22} strokeWidth={1.8} aria-label="본인 인증 완료" />
          </h1>
          <p className="m-0 mt-1 text-[14px] leading-[22px] text-[var(--fg-muted)]">20대 · {profile.area}</p>
          <p className="m-0 mt-1 text-[14px] leading-[22px] text-[var(--fg-neutral)]">본인 인증 완료 · 출석 신뢰 안정적</p>
        </div>
      </section>

      <button
        type="button"
        onClick={() => setEditingProfile(true)}
        className="flex min-h-[52px] items-center justify-between text-[14px] leading-5 text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-[-2px]"
      >
        <span>표시 프로필 수정</span>
        <ChevronRight className="text-[var(--fg-muted)]" size={22} strokeWidth={1.8} aria-hidden="true" />
      </button>

      <AnimatePresence initial={false}>
        {editingProfile ? (
          <motion.form
            key="profile-edit-form"
            className="grid gap-3 overflow-hidden border-y border-[var(--stroke-neutral)] py-4"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: "tween", duration: 0.18, ease: "easeOut" }
            }
            onSubmit={saveProfile}
          >
            {([
              ["name", "표시 이름", profile.name],
              ["interests", "관심 활동", profile.interests],
              ["area", "활동 지역", profile.area],
              ["availability", "활동 가능 시간", profile.availability],
            ] as const).map(([name, label, value]) => (
              <label className="grid gap-1 text-[14px] text-[var(--fg-muted)]" key={name}>
                {label}
                <input
                  className="min-h-[44px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-3 text-[16px] text-[var(--fg-neutral)]"
                  defaultValue={value}
                  name={name}
                  required
                />
              </label>
            ))}
            <div className="flex gap-2">
              <button className="min-h-[44px] flex-1 border border-[var(--stroke-neutral)]" type="button" onClick={() => setEditingProfile(false)}>
                취소
              </button>
              <button className="min-h-[44px] flex-1 bg-[var(--brand-accent)] font-bold text-[var(--fg-on-brand)]" type="submit">
                저장하기
              </button>
            </div>
          </motion.form>
        ) : null}
      </AnimatePresence>

      <section aria-labelledby="my-info-title">
        <h2 id="my-info-title" className="m-0 mt-1 text-[13px] font-normal leading-5 text-[var(--fg-muted)]">내 정보</h2>
        <ProfileRow icon={Heart} title="관심 활동" description={profile.interests} onClick={() => setEditingProfile(true)} />
        <ProfileRow icon={MapPin} title="활동 지역" description={profile.area} onClick={() => setEditingProfile(true)} />
        <ProfileRow icon={Clock3} title="활동 가능 시간" description={profile.availability} onClick={() => setEditingProfile(true)} />
      </section>

      <section aria-labelledby="app-settings-title">
        <h2 id="app-settings-title" className="mb-1 mt-1 border-t border-[var(--stroke-neutral)] pt-1 text-[13px] font-normal leading-5 text-[var(--fg-muted)]">앱 설정</h2>
        <ProfileRow icon={Bell} title="알림 설정" href="/notifications" />
        <ProfileRow icon={Ban} title="차단 목록" href="/profile/blocks" />
        <ProfileRow icon={Link2} title="연결 목록" href="/connections" />
        <AnimatedDialog
          open={logoutRequested}
          onOpenChange={(open) => {
            if (open) {
              setLogoutRequested(true);
              return;
            }

            logoutCommitRequested.current = false;
            setLogoutRequested(false);
          }}
          onExitComplete={commitLogoutAfterExit}
          trigger={
            <ProfileRow
              icon={LogOut}
              title={loggedOut ? "로그아웃 완료" : "로그아웃"}
              muted
              onClick={() => setLogoutRequested(true)}
            />
          }
        >
          <AnimatedDialogTitle className="m-0 text-[16px] font-bold leading-6 text-[var(--fg-neutral)]">
            로그아웃할까요?
          </AnimatedDialogTitle>
          <AnimatedDialogDescription className="m-0 mt-2 text-[14px] leading-5 text-[var(--fg-muted)]">
            다시 로그인해야 내 모임과 연결을 확인할 수 있어요.
          </AnimatedDialogDescription>
          <div className="mt-3 flex gap-2">
            <AnimatedDialogClose asChild>
              <button
                type="button"
                className="min-h-[44px] flex-1 border border-[var(--stroke-neutral)] px-3 text-[15px] text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                autoFocus
              >
                취소
              </button>
            </AnimatedDialogClose>
            <button
              type="button"
              className="min-h-[44px] flex-1 bg-[var(--fg-neutral)] px-3 text-[15px] text-[var(--bg-layer-floating)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
              onClick={confirmLogout}
            >
              로그아웃
            </button>
          </div>
        </AnimatedDialog>
      </section>

      {loggedOut ? (
        <p className="m-0 pt-3 text-[14px] leading-5 text-[var(--fg-muted)]" role="status">다시 로그인하면 모임을 계속 이용할 수 있어요.</p>
      ) : null}

    </ScreenShell>
  );
}
