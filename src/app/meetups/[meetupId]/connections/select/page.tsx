"use client";

import { Check, ChevronRight, Plus, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";

import { BottomActionBar } from "@/components/bottom-action-bar";
import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";

const checkedInMembers = [
  { id: "jimin", initial: "ㅈ", name: "지민", age: "20대", activity: "산책" },
  { id: "seoun", initial: "ㅅ", name: "서윤", age: "30대", activity: "산책" },
  { id: "hyeonu", initial: "ㅎ", name: "현우", age: "20대", activity: "산책" },
] as const;

export default function ConnectionSelectPage() {
  const params = useParams<{ meetupId: string }>();
  const meetupId = typeof params.meetupId === "string" ? params.meetupId : "han-river-walk";
  const meetupHref = `/meetups/${encodeURIComponent(meetupId)}`;
  const [selectedMembers, setSelectedMembers] = useState<string[]>(["jimin"]);
  const [completed, setCompleted] = useState(false);

  function toggleMember(memberId: string) {
    setSelectedMembers((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    );
    setCompleted(false);
  }

  return (
    <ScreenShell bottomSpacing>
      <TopNavigation
        href={meetupHref}
        title={<span className="font-display text-[length:var(--type-page-title)] font-normal leading-6">다시 연결하기</span>}
      />

      <div className="flex flex-1 flex-col px-5 pb-8">
        <section className="mt-7" aria-labelledby="connection-select-heading">
          <h2
            id="connection-select-heading"
            className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 tracking-[-0.03em] text-[var(--fg-neutral)]"
          >
            다시 이야기하고 싶은 사람이 있나요?
          </h2>
          <p className="m-0 mt-4 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
            체크인한 참가자만 보여요.
            <br />
            내 선택은 서로 선택되기 전까지 비공개예요.
          </p>
        </section>

        <section className="mt-7" aria-label="체크인한 참가자 목록">
          <ul className="m-0 list-none divide-y divide-[var(--stroke-neutral)] border-y border-[var(--stroke-neutral)] p-0">
            {checkedInMembers.map((member) => {
              const selected = selectedMembers.includes(member.id);
              return (
                <li key={member.id}>
                  <button
                    className="flex min-h-[80px] w-full items-center gap-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${member.name}, ${selected ? "선택됨" : "선택하지 않음"}`}
                    onClick={() => toggleMember(member.id)}
                  >
                    <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[var(--bg-neutral-weak)] font-display text-[length:var(--type-headline)] leading-8 text-[var(--fg-neutral)]" aria-hidden="true">
                      {member.initial}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[length:var(--type-title)] font-semibold leading-5 text-[var(--fg-neutral)]">{member.name}</span>
                      <span className="block text-[length:var(--type-meta)] leading-4 text-[var(--fg-muted)]">{member.age} · {member.activity} · 체크인 완료</span>
                    </span>
                    <span
                      className={`flex size-14 shrink-0 items-center justify-center rounded-full bg-[var(--bg-neutral-weak)] ${selected ? "text-[var(--fg-neutral)]" : "text-[var(--fg-neutral)]"}`}
                      aria-hidden="true"
                    >
                      {selected ? <Check size={30} strokeWidth={2} /> : <Plus size={30} strokeWidth={1.8} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="mt-5 flex items-start gap-3 rounded-2xl bg-[var(--bg-neutral-weak)] px-4 py-4" aria-label="연결 선택 안내">
          <ShieldCheck className="mt-0.5 shrink-0 text-[var(--fg-muted)]" size={24} strokeWidth={1.8} aria-hidden="true" />
          <p className="m-0 text-[length:var(--type-section)] leading-6 text-[var(--fg-neutral)]">외모·인기·스와이프 없이 사람을 직접 선택해요.</p>
        </aside>

        {completed ? (
          <p className="mt-4 flex items-center gap-1 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-positive)]" role="status" aria-live="polite">
            선택을 저장했어요. 서로 선택하면 연결돼요.
            <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" />
          </p>
        ) : null}
      </div>

      <BottomActionBar>
        <button
          className="flex min-h-[52px] w-full items-center justify-center bg-[var(--brand-accent)] px-4 text-[length:var(--type-action)] font-semibold leading-6 text-[var(--fg-on-brand)] focus-visible:outline-2 focus-visible:outline-[var(--fg-neutral)] focus-visible:outline-offset-2"
          type="button"
          onClick={() => setCompleted(true)}
        >
          선택 완료
        </button>
      </BottomActionBar>
    </ScreenShell>
  );
}
