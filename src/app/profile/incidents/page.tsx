"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { OfflineNotice } from "@/components/offline-notice";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";
import { ApiProblemError } from "@/lib/api/client";
import type { Incident } from "@/lib/api/types";
import { useOptionalAuthSession } from "@/lib/auth/auth-session-provider";
import { SessionExpiredError } from "@/lib/auth/session-store";

const pageSize = 20;
function errorMessage(error: unknown, fallback: string): string { return error instanceof ApiProblemError ? error.problem?.detail ?? fallback : fallback; }

export default function IncidentsPage() {
  const auth = useOptionalAuthSession();
  const subject = auth?.snapshot.status === "authenticated" ? auth.snapshot.user.id : null;
  const sessionEpoch = auth?.sessionEpoch ?? 0;
  // Session-scoped key: same subject re-login is a fresh session.
  const sessionKey = subject ? `${sessionEpoch}:${subject}` : null;
  const sessionKeyRef = useRef(sessionKey); sessionKeyRef.current = sessionKey;
  const requestRef = useRef(0);
  const appendRef = useRef<Promise<void> | null>(null);
  const [items, setItems] = useState<Incident[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [appendError, setAppendError] = useState<string | null>(null);
  const [appending, setAppending] = useState(false);
  const load = useCallback(async () => { if (!auth || !sessionKey) return; const request = ++requestRef.current; setState("loading"); setAppendError(null); try { const page = await auth.listIncidents({ limit: pageSize }); if (requestRef.current !== request || sessionKeyRef.current !== sessionKey) return; setItems(page.items); setNextCursor(page.nextCursor ?? null); setState("ready"); } catch (error) { if (requestRef.current !== request || sessionKeyRef.current !== sessionKey || error instanceof SessionExpiredError) return; setItems([]); setNextCursor(null); setState("error"); setAppendError(errorMessage(error, "신고 결과를 불러오지 못했어요. 다시 시도해 주세요.")); } }, [auth, sessionKey]);
  const append = async () => { if (!auth || !sessionKey || !nextCursor || appendRef.current) return; const requestedSessionKey = sessionKey; const cursor = nextCursor; setAppending(true); setAppendError(null); const request = (async () => { try { const page = await auth.listIncidents({ cursor, limit: pageSize }); if (sessionKeyRef.current !== requestedSessionKey) return; setItems((current) => { const known = new Set(current.map((item) => item.incidentId)); return [...current, ...page.items.filter((item) => !known.has(item.incidentId))]; }); setNextCursor(page.nextCursor ?? null); } catch (error) { if (sessionKeyRef.current !== requestedSessionKey || error instanceof SessionExpiredError) return; setAppendError(errorMessage(error, "다음 신고 결과를 불러오지 못했어요. 다시 시도해 주세요.")); } finally { if (sessionKeyRef.current === requestedSessionKey) setAppending(false); } })(); appendRef.current = request; await request; if (appendRef.current === request) appendRef.current = null; };
  useEffect(() => { requestRef.current += 1; appendRef.current = null; setItems([]); setNextCursor(null); setState("idle"); setAppendError(null); setAppending(false); if (sessionKey) void load(); return () => { requestRef.current += 1; }; }, [load, sessionKey]);
  if (!subject || !auth) return <ScreenShell className="px-5 pb-8" aria-label="로그인 필요"><TopNavigation href="/profile" title="신고 결과" /><p className="pt-12 text-[14px] text-[var(--fg-muted)]">로그인 후 내가 제출한 신고 결과를 확인할 수 있어요.</p></ScreenShell>;
  return <ScreenShell className="px-5 pb-8"><TopNavigation href="/profile" title="신고 결과" /><main className="pt-6" aria-labelledby="incidents-heading"><h1 id="incidents-heading" className="m-0 text-[18px] font-bold text-[var(--fg-neutral)]">내 신고 결과</h1><OfflineNotice className="mt-4" />{state === "loading" ? <p role="status" className="mt-5 text-[14px] text-[var(--fg-muted)]">신고 결과를 불러오는 중이에요.</p> : null}{state === "error" ? <section role="alert" className="mt-5 grid gap-3"><p className="m-0 text-[14px] text-[var(--fg-neutral)]">{appendError}</p><button type="button" onClick={() => void load()} className="min-h-[44px] border border-[var(--stroke-neutral)]">다시 불러오기</button></section> : null}{state === "ready" && !items.length ? <p className="mt-5 text-[14px] text-[var(--fg-muted)]">제출한 신고가 없어요.</p> : null}{state === "ready" && items.length ? <><ul className="m-0 mt-5 grid list-none gap-3 p-0">{items.map((incident) => <li key={incident.incidentId} className="rounded-2xl border border-[var(--stroke-neutral)] p-4"><strong className="text-[15px] text-[var(--fg-neutral)]">{incident.state}</strong><dl className="m-0 mt-3 grid gap-1 text-[13px] text-[var(--fg-muted)]"><div><dt className="inline">분류: </dt><dd className="inline">{incident.category}</dd></div><div><dt className="inline">우선순위: </dt><dd className="inline">{incident.priority}</dd></div><div><dt className="inline">제출: </dt><dd className="inline break-all">{incident.submittedAt}</dd></div></dl></li>)}</ul>{appendError ? <section role="alert" className="mt-4 grid gap-2"><p className="m-0 text-[14px] text-[var(--fg-neutral)]">{appendError}</p><button type="button" onClick={() => void append()} disabled={appending} className="min-h-[44px] border border-[var(--stroke-neutral)]">다시 시도</button></section> : null}{nextCursor ? <button type="button" onClick={() => void append()} disabled={appending} className="mt-4 min-h-[44px] w-full border border-[var(--stroke-neutral)] text-[14px] font-bold text-[var(--fg-neutral)] disabled:opacity-60">{appending ? "더 불러오는 중" : "더 불러오기"}</button> : null}</> : null}</main></ScreenShell>;
}
