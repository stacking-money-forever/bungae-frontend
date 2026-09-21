"use client";

import Link from "next/link";
import {
  Ban,
  Bell,
  BadgeCheck,
  ChevronRight,
  FileWarning,
  Heart,
  Link2,
  LogOut,
  UserRoundX,
  ListChecks,
  MapPin,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { ApiProblemError } from "@/lib/api/client";
import type { ActivityPolicy, ProfilePatch, UserProfile } from "@/lib/api/types";
import {
  AnimatedDialog,
  AnimatedDialogClose,
  AnimatedDialogDescription,
  AnimatedDialogTitle,
} from "@/components/animated-dialog";
import { OfflineNotice } from "@/components/offline-notice";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";
import { useAuthSession } from "@/lib/auth/auth-session-provider";
import { SessionExpiredError } from "@/lib/auth/session-store";
import { useOnlineStatus } from "@/lib/ui/online";


type LoadState = "idle" | "loading" | "ready" | "error";
type VerificationState = "idle" | "requesting" | "ready" | "error";
type ProfileDraft = Pick<
  UserProfile,
  "displayName" | "ageBand" | "bio" | "interestCodes" | "homeAreaCode"
>;

type SubjectValue<T> = { subject: string | null; value: T };
type SaveState = { pending: boolean; error: string | null; conflict: boolean };
type Verification = {
  state: VerificationState;
  url: string | null;
  expiresAt: string | null;
  error: string | null;
};


const ageBandLabels: Record<UserProfile["ageBand"], string> = {
  "18_24": "18–24세",
  "25_34": "25–34세",
  "35_44": "35–44세",
  "45_PLUS": "45세 이상",
};

const initialSave: SaveState = { pending: false, error: null, conflict: false };
const initialVerification: Verification = { state: "idle", url: null, expiresAt: null, error: null };

function ProfileRow({
  icon: Icon,
  title,
  description,
  href,
  onClick,
  muted = false,
  disabled = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  muted?: boolean;
  disabled?: boolean;
}) {
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
    return <Link href={href} className="flex min-h-[44px] w-full items-center gap-3 focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-[-2px]">{content}</Link>;
  }
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="flex min-h-[44px] w-full items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-[-2px] disabled:cursor-not-allowed disabled:opacity-60">
      {content}
    </button>
  );
}

function toDraft(profile: UserProfile): ProfileDraft {
  return {
    displayName: profile.displayName,
    ageBand: profile.ageBand,
    bio: profile.bio ?? "",
    interestCodes: profile.interestCodes,
    homeAreaCode: profile.homeAreaCode,
  };
}

function isSafeProviderUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function message(error: unknown, fallback: string): string {
  return error instanceof ApiProblemError ? error.problem?.detail ?? fallback : fallback;
}

export default function ProfilePage() {
  const { logout, snapshot, getMe, updateMe, getActivityPolicies, createVerificationSession, sessionEpoch } = useAuthSession();
  const subject = snapshot.status === "authenticated" ? snapshot.user.id : null;
  // Session-scoped identity: the same subject logging in again after logout is
  // a distinct session, so late completions from the old login cannot commit.
  const sessionKey = subject ? `${sessionEpoch}:${subject}` : null;
  const sessionKeyRef = useRef(sessionKey);
  sessionKeyRef.current = sessionKey;
  const online = useOnlineStatus();
  const profileRequest = useRef(0);
  const policiesRequest = useRef(0);
  const logoutCommitRequested = useRef(false);

  const [profile, setProfile] = useState<SubjectValue<UserProfile | null>>({ subject: null, value: null });
  const [profileLoad, setProfileLoad] = useState<LoadState>("idle");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [policyData, setPolicyData] = useState<SubjectValue<ActivityPolicy[]>>({ subject: null, value: [] });
  const [policiesLoad, setPoliciesLoad] = useState<LoadState>("idle");
  const [policiesError, setPoliciesError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [editor, setEditor] = useState<SubjectValue<boolean>>({ subject: null, value: false });
  const [save, setSave] = useState<SubjectValue<SaveState>>({ subject: null, value: initialSave });
  const [verification, setVerification] = useState<SubjectValue<Verification>>({ subject: null, value: initialVerification });
  const [logoutRequested, setLogoutRequested] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  const currentProfile = profile.subject === sessionKey ? profile.value : null;
  const currentPolicies = policyData.subject === sessionKey ? policyData.value : [];
  const currentSave = save.subject === sessionKey ? save.value : initialSave;
  const currentVerification = verification.subject === sessionKey ? verification.value : initialVerification;
  const editing = editor.subject === sessionKey && editor.value;

  const loadProfile = useCallback(async () => {
    if (!subject || !sessionKey) return;
    const request = ++profileRequest.current;
    setProfileLoad("loading");
    setProfileError(null);
    try {
      const next = await getMe();
      if (profileRequest.current !== request || sessionKeyRef.current !== sessionKey) return;
      setProfile({ subject: sessionKey, value: next });
      setDraft(toDraft(next));
      setProfileLoad("ready");
    } catch (error) {
      if (profileRequest.current !== request || sessionKeyRef.current !== sessionKey || error instanceof SessionExpiredError) return;
      setProfileLoad("error");
      setProfileError(message(error, "프로필을 불러오지 못했어요. 다시 시도해 주세요."));
    }
  }, [getMe, sessionKey, subject]);

  const loadPolicies = useCallback(async () => {
    if (!subject || !sessionKey) return;
    const request = ++policiesRequest.current;
    setPoliciesLoad("loading");
    setPoliciesError(null);
    try {
      const items: ActivityPolicy[] = [];
      const seen = new Set<string>();
      let cursor: string | undefined;
      do {
        if (cursor) {
          if (seen.has(cursor)) break;
          seen.add(cursor);
        }
        const page = await getActivityPolicies(cursor);
        items.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      if (policiesRequest.current !== request || sessionKeyRef.current !== sessionKey) return;
      setPolicyData({ subject: sessionKey, value: items });
      setPoliciesLoad("ready");
    } catch (error) {
      if (policiesRequest.current !== request || sessionKeyRef.current !== sessionKey || error instanceof SessionExpiredError) return;
      setPoliciesLoad("error");
      setPoliciesError(message(error, "활동 종류를 불러오지 못했어요. 다시 시도해 주세요."));
    }
  }, [getActivityPolicies, sessionKey, subject]);

  useEffect(() => {
    profileRequest.current += 1;
    policiesRequest.current += 1;
    logoutCommitRequested.current = false;
    setProfile({ subject: null, value: null });
    setProfileLoad("idle");
    setProfileError(null);
    setPolicyData({ subject: null, value: [] });
    setPoliciesLoad("idle");
    setPoliciesError(null);
    setDraft(null);
    setEditor({ subject: null, value: false });
    setSave({ subject: null, value: initialSave });
    setVerification({ subject: null, value: initialVerification });
    setLoggedOut(false);
    setLogoutMessage(null);
    if (!subject || !sessionKey) return;
    void loadProfile();
    void loadPolicies();
    return () => {
      profileRequest.current += 1;
      policiesRequest.current += 1;
    };
  }, [loadPolicies, loadProfile, sessionKey, subject]);

  if (!subject) {
    return (
      <ScreenShell className="px-5 pb-8" aria-label="로그인 필요">
        <TopNavigation href="/" title={<span className="font-display text-[16px] font-normal leading-6">프로필</span>} className="-mx-5 px-4" />
        <section className="pt-12" aria-labelledby="profile-auth-heading">
          <h1 id="profile-auth-heading" className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">
            로그인하고 프로필을 확인해 주세요
          </h1>
          <p className="m-0 mt-4 text-[14px] leading-[22px] text-[var(--fg-muted)]">
            프로필 정보와 설정은 로그인한 계정의 서버 정보에서만 표시해요.
          </p>
          <Link className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-[12px] bg-[var(--brand-accent)] px-4 text-[14px] font-bold text-[var(--fg-on-brand)]" href="/auth">
            휴대전화로 로그인하기
          </Link>
        </section>
      </ScreenShell>
    );
  }

  const openEditor = () => {
    if (!sessionKey || !currentProfile || !online) return;
    setDraft(toDraft(currentProfile));
    setSave({ subject: sessionKey, value: initialSave });
    setEditor({ subject: sessionKey, value: true });
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionKey || !currentProfile || !draft) return;
    const submittedSessionKey = sessionKey;
    if (!online) {
      setSave({
        subject: submittedSessionKey,
        value: { pending: false, error: "인터넷 연결이 끊겨 프로필을 저장할 수 없어요. 연결을 확인한 뒤 다시 시도해 주세요.", conflict: false },
      });
      return;
    }
    const patch: ProfilePatch = {
      displayName: draft.displayName,
      ageBand: draft.ageBand,
      bio: draft.bio,
      interestCodes: draft.interestCodes,
      homeAreaCode: draft.homeAreaCode,
    };
    setSave({ subject: submittedSessionKey, value: { pending: true, error: null, conflict: false } });
    try {
      const updated = await updateMe(patch, currentProfile.version);
      if (sessionKeyRef.current !== submittedSessionKey) return;
      setProfile({ subject: submittedSessionKey, value: updated });
      setDraft(toDraft(updated));
      setEditor({ subject: submittedSessionKey, value: false });
    } catch (error) {
      if (sessionKeyRef.current !== submittedSessionKey || error instanceof SessionExpiredError) return;
      setSave({
        subject: submittedSessionKey,
        value: {
          pending: false,
          error: message(error, "프로필을 저장하지 못했어요. 다시 시도해 주세요."),
          conflict: error instanceof ApiProblemError && error.status === 409,
        },
      });
      return;
    }
    if (sessionKeyRef.current === submittedSessionKey) setSave({ subject: submittedSessionKey, value: initialSave });
  };

  const startVerification = async () => {
    if (!sessionKey) return;
    const submittedSessionKey = sessionKey;
    if (!online) {
      setVerification({ subject: submittedSessionKey, value: { ...initialVerification, state: "error", error: "인터넷 연결이 끊겨 인증을 시작할 수 없어요. 연결을 확인한 뒤 다시 시도해 주세요." } });
      return;
    }
    setVerification({ subject: submittedSessionKey, value: { ...initialVerification, state: "requesting" } });
    try {
      const session = await createVerificationSession(`${window.location.origin}/profile`);
      if (sessionKeyRef.current !== submittedSessionKey) return;
      if (!isSafeProviderUrl(session.providerUrl)) {
        setVerification({ subject: submittedSessionKey, value: { ...initialVerification, state: "error", error: "안전한 HTTPS 인증 주소를 받지 못했어요. 다시 시도해 주세요." } });
        return;
      }
      setVerification({ subject: submittedSessionKey, value: { state: "ready", url: session.providerUrl, expiresAt: session.expiresAt, error: null } });
    } catch (error) {
      if (sessionKeyRef.current !== submittedSessionKey || error instanceof SessionExpiredError) return;
      setVerification({ subject: submittedSessionKey, value: { ...initialVerification, state: "error", error: message(error, "인증을 시작하지 못했어요. 다시 시도해 주세요.") } });
    }
  };

  const commitLogoutAfterExit = () => {
    if (!logoutCommitRequested.current) return;
    logoutCommitRequested.current = false;
    void logout().then((result) => {
      setLoggedOut(true);
      if (!result.ok) setLogoutMessage("로그아웃했지만 알림 연결 해제 또는 서버 세션 종료를 확인하지 못했어요.");
    });
  };

  const name = currentProfile?.displayName ?? "";
  const area = currentProfile?.homeAreaCode ?? "";
  const age = currentProfile ? ageBandLabels[currentProfile.ageBand] : "";
  const interests = currentProfile
    ? currentProfile.interestCodes.map((code) => currentPolicies.find((policy) => policy.code === code)?.name ?? code).join(" · ") || "선택한 활동 없음"
    : "";
  const canEdit = profileLoad === "ready" && Boolean(currentProfile) && online;

  return (
    <ScreenShell className="px-5 pb-8">
      <TopNavigation
        href="/"
        title={<span className="font-display text-[16px] font-normal leading-6">프로필</span>}
        className="-mx-5 px-4"
        trailing={<button type="button" onClick={openEditor} disabled={!canEdit} aria-label="프로필 설정" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-[var(--fg-muted)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2 disabled:opacity-60"><Settings size={25} strokeWidth={1.8} aria-hidden="true" /></button>}
      />

      <OfflineNotice className="mt-6" />
      {subject && profileLoad === "loading" ? <p className="mt-6 text-[14px] leading-5 text-[var(--fg-muted)]" role="status">프로필을 불러오는 중이에요.</p> : null}
      {subject && profileLoad === "error" ? (
        <section className="mt-6 grid gap-3" aria-labelledby="profile-load-error">
          <p id="profile-load-error" className="m-0 text-[14px] leading-5 text-[var(--fg-neutral)]" role="alert">{profileError}</p>
          <button type="button" onClick={() => void loadProfile()} className="min-h-[44px] border border-[var(--stroke-neutral)] px-3 text-[14px] text-[var(--fg-neutral)]">프로필 다시 불러오기</button>
        </section>
      ) : null}

      {profileLoad === "ready" && currentProfile ? (
        <>
          <section className="mt-3 flex min-h-[100px] items-center gap-2 rounded-2xl bg-[var(--bg-layer-floating)] px-3 py-3" aria-labelledby="profile-name">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent)] text-[18px] font-bold text-[var(--fg-on-brand)]" aria-hidden="true">{name.slice(0, 1)}</span>
            <div className="min-w-0">
              <h1 id="profile-name" className="m-0 flex items-center gap-2 text-[16px] font-bold leading-6 text-[var(--fg-neutral)]">{name}{currentProfile?.identityVerified ? <BadgeCheck className="shrink-0 text-[var(--fg-neutral)]" size={22} strokeWidth={1.8} aria-label="본인 인증 완료" /> : null}</h1>
              <p className="m-0 mt-1 text-[14px] leading-[22px] text-[var(--fg-muted)]">{age} · {area}</p>
              <p className="m-0 mt-1 text-[14px] leading-[22px] text-[var(--fg-neutral)]">
                {currentProfile.adultVerified ? "성인 인증 완료" : "성인 인증 필요"}
                {currentProfile.identityVerified ? " · 본인 인증 완료" : " · 본인 인증 필요"}
              </p>
            </div>
          </section>
          <button type="button" onClick={openEditor} disabled={!canEdit} className="flex min-h-[52px] items-center justify-between text-[14px] leading-5 text-[var(--fg-neutral)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-[-2px] disabled:cursor-not-allowed disabled:opacity-60"><span>표시 프로필 수정</span><ChevronRight className="text-[var(--fg-muted)]" size={22} strokeWidth={1.8} aria-hidden="true" /></button>

          {editing ? (
            <form className="grid gap-3 border-y border-[var(--stroke-neutral)] py-4" onSubmit={(event) => void saveProfile(event)}>
              {sessionKey && draft ? (
                <>
                  <OfflineNotice />
                  <label className="grid gap-1 text-[14px] text-[var(--fg-muted)]">표시 이름<input className="min-h-[44px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-3 text-[16px] text-[var(--fg-neutral)]" value={draft.displayName} minLength={2} maxLength={20} required onChange={(event) => setDraft((value) => value ? { ...value, displayName: event.target.value } : value)} /></label>
                  <label className="grid gap-1 text-[14px] text-[var(--fg-muted)]">연령대<select className="min-h-[44px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-3 text-[16px] text-[var(--fg-neutral)]" value={draft.ageBand} onChange={(event) => setDraft((value) => value ? { ...value, ageBand: event.target.value as UserProfile["ageBand"] } : value)}>{Object.entries(ageBandLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
                  <label className="grid gap-1 text-[14px] text-[var(--fg-muted)]">소개<textarea className="min-h-[88px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-3 py-2 text-[16px] text-[var(--fg-neutral)]" value={draft.bio} maxLength={300} onChange={(event) => setDraft((value) => value ? { ...value, bio: event.target.value } : value)} /></label>
                  <fieldset className="grid gap-2 border-0 p-0 text-[14px] text-[var(--fg-muted)]"><legend>관심 활동</legend>
                    {policiesLoad === "loading" ? <span role="status">활동 종류를 불러오는 중이에요.</span> : null}
                    {policiesLoad === "error" ? <div className="grid gap-2"><span role="alert">{policiesError}</span><button type="button" onClick={() => void loadPolicies()} className="min-h-[44px] border border-[var(--stroke-neutral)] px-3 text-[14px] text-[var(--fg-neutral)]">활동 종류 다시 불러오기</button></div> : null}
                    {currentPolicies.map((policy) => {
                      const checked = draft.interestCodes.includes(policy.code);
                      return <label key={policy.code} className="flex min-h-[44px] items-center gap-2 text-[var(--fg-neutral)]"><input type="checkbox" checked={checked} onChange={() => setDraft((value) => value ? { ...value, interestCodes: checked ? value.interestCodes.filter((code) => code !== policy.code) : [...value.interestCodes, policy.code] } : value)} />{policy.name}</label>;
                    })}
                    {draft.interestCodes.filter((code) => !currentPolicies.some((policy) => policy.code === code)).map((code) => <span key={code} className="text-[12px] text-[var(--fg-muted)]">{code}</span>)}
                  </fieldset>
                  <label className="grid gap-1 text-[14px] text-[var(--fg-muted)]">활동 지역 코드<input className="min-h-[44px] border border-[var(--stroke-neutral)] bg-[var(--bg-layer-floating)] px-3 text-[16px] text-[var(--fg-neutral)]" value={draft.homeAreaCode} required onChange={(event) => setDraft((value) => value ? { ...value, homeAreaCode: event.target.value } : value)} /></label>
                  {currentSave.error ? <div className="grid gap-2" role="alert"><p className="m-0 text-[14px] leading-5 text-[var(--fg-neutral)]">{currentSave.error}</p>{currentSave.conflict ? <button type="button" onClick={() => { setEditor({ subject: null, value: false }); void loadProfile(); }} className="min-h-[44px] border border-[var(--stroke-neutral)] px-3 text-[14px] text-[var(--fg-neutral)]">최신 프로필 다시 불러오기</button> : null}</div> : null}
                </>
              ) : (
                null
              )}
              <div className="flex gap-2"><button type="button" disabled={currentSave.pending} onClick={() => setEditor({ subject: null, value: false })} className="min-h-[44px] flex-1 border border-[var(--stroke-neutral)]">취소</button><button type="submit" disabled={currentSave.pending || !online} className="min-h-[44px] flex-1 bg-[var(--brand-accent)] font-bold text-[var(--fg-on-brand)] disabled:opacity-60">{currentSave.pending ? "저장 중" : "저장하기"}</button></div>
            </form>
          ) : null}

          <section aria-labelledby="my-info-title"><h2 id="my-info-title" className="m-0 mt-1 text-[13px] font-normal leading-5 text-[var(--fg-muted)]">내 정보</h2><ProfileRow icon={Heart} title="관심 활동" description={interests} onClick={openEditor} disabled={!canEdit} /><ProfileRow icon={MapPin} title="활동 지역" description={area} onClick={openEditor} disabled={!canEdit} /></section>

          {currentProfile ? <section className="mt-3 grid gap-3 border-t border-[var(--stroke-neutral)] pt-3" aria-labelledby="verification-title">
            <h2 id="verification-title" className="m-0 text-[15px] font-bold leading-6 text-[var(--fg-neutral)]">성인·본인 인증</h2>
            {currentProfile.adultVerified && currentProfile.identityVerified ? <p className="m-0 text-[14px] leading-5 text-[var(--fg-neutral)]" role="status">성인 및 본인 인증이 완료되었어요.</p> : <>
              <p className="m-0 text-[14px] leading-5 text-[var(--fg-neutral)]">안전한 모임을 위해 성인·본인 인증이 필요해요. 인증을 나중에 해도 탐색은 가능하지만, 모임 생성과 참여는 제한돼요.</p>
              <ul className="m-0 grid gap-1 pl-5 text-[13px] leading-5 text-[var(--fg-muted)]"><li>예상 소요 시간은 인증 제공자 화면에서 안내해요.</li><li>신분증 원본은 저장하지 않아요. 인증 결과와 제공자 참조값만 저장해요.</li><li>실명은 다른 사용자에게 공개하지 않아요.</li></ul>
              {currentVerification.state === "ready" && currentVerification.url ? <div className="grid gap-2" role="status"><p className="m-0 text-[14px] leading-5 text-[var(--fg-neutral)]">인증 제공자 화면을 열 준비가 됐어요.{currentVerification.expiresAt ? ` ${new Date(currentVerification.expiresAt).toLocaleString("ko-KR")}까지 유효해요.` : ""}</p><button type="button" onClick={() => { if (currentVerification.url && isSafeProviderUrl(currentVerification.url)) window.location.assign(currentVerification.url); }} className="min-h-[44px] bg-[var(--brand-accent)] px-3 text-[14px] font-bold text-[var(--fg-on-brand)]">인증 제공자에서 계속하기</button></div> : null}
              {currentVerification.state === "error" ? <p className="m-0 text-[14px] leading-5 text-[var(--fg-neutral)]" role="alert">{currentVerification.error}</p> : null}
              <button type="button" disabled={currentVerification.state === "requesting" || !online} onClick={() => void startVerification()} className="min-h-[44px] bg-[var(--brand-accent)] px-3 text-[14px] font-bold text-[var(--fg-on-brand)] disabled:opacity-60">{currentVerification.state === "requesting" ? "인증 준비 중" : currentVerification.state === "error" ? "인증 다시 시도" : "인증 시작"}</button>
              <p className="m-0 text-[12px] leading-5 text-[var(--fg-muted)]">문제가 계속되면 고객 지원으로 문의해 주세요.</p>
            </>}
          </section> : null}
        </>
      ) : null}

      <section aria-labelledby="app-settings-title"><h2 id="app-settings-title" className="mb-1 mt-3 border-t border-[var(--stroke-neutral)] pt-1 text-[13px] font-normal leading-5 text-[var(--fg-muted)]">앱 설정</h2><ProfileRow icon={Bell} title="알림 설정" href="/notifications" /><ProfileRow icon={Ban} title="차단 목록" href="/profile/blocks" /><ProfileRow icon={Link2} title="연결 목록" href="/connections" /><ProfileRow icon={UserRoundX} title="계정 탈퇴" href="/profile/withdrawal" /><ProfileRow icon={ListChecks} title="노쇼 이의" href="/profile/no-show-appeals" /><ProfileRow icon={FileWarning} title="신고 결과" href="/profile/incidents" />
        <AnimatedDialog open={logoutRequested} onOpenChange={(open) => { if (open) setLogoutRequested(true); else { logoutCommitRequested.current = false; setLogoutRequested(false); } }} onExitComplete={commitLogoutAfterExit} trigger={<ProfileRow icon={LogOut} title={loggedOut ? "로그아웃 완료" : "로그아웃"} muted disabled={!online} onClick={() => setLogoutRequested(true)} />}>
          <AnimatedDialogTitle className="m-0 text-[16px] font-bold leading-6 text-[var(--fg-neutral)]">로그아웃할까요?</AnimatedDialogTitle><AnimatedDialogDescription className="m-0 mt-2 text-[14px] leading-5 text-[var(--fg-muted)]">다시 로그인해야 내 모임과 연결을 확인할 수 있어요.</AnimatedDialogDescription><div className="mt-3 flex gap-2"><AnimatedDialogClose asChild><button type="button" autoFocus className="min-h-[44px] flex-1 border border-[var(--stroke-neutral)] px-3 text-[15px] text-[var(--fg-neutral)]">취소</button></AnimatedDialogClose><button type="button" disabled={!online} onClick={() => { logoutCommitRequested.current = true; setLogoutRequested(false); }} className="min-h-[44px] flex-1 bg-[var(--fg-neutral)] px-3 text-[15px] text-[var(--bg-layer-floating)] disabled:opacity-60">로그아웃</button></div>
        </AnimatedDialog>
      </section>
      {loggedOut ? <p className="m-0 pt-3 text-[14px] leading-5 text-[var(--fg-muted)]" role="status">{logoutMessage ?? "다시 로그인하면 모임을 계속 이용할 수 있어요."}</p> : null}
    </ScreenShell>
  );
}
