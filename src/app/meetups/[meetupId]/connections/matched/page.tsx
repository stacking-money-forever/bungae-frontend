"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";
import { chromePrimaryButtonClassName } from "@/lib/ui/connection-copy";

export default function MatchedConnectionPage() {
  const params = useParams<{ meetupId: string }>();
  const meetupId = typeof params.meetupId === "string" ? params.meetupId : "";
  return (
    <ScreenShell className="px-5 pb-8">
      <TopNavigation href={`/meetups/${encodeURIComponent(meetupId)}`} title={<span>연결 안내</span>} />
      <section className="pt-6" aria-labelledby="matched-connection-heading">
        <h1 id="matched-connection-heading" className="m-0 font-display text-[length:var(--type-headline)] font-normal leading-8 text-[var(--fg-neutral)]">
          이 화면에서는 연결 내용을 볼 수 없어요
        </h1>
        <p className="m-0 mt-4 text-[length:var(--type-body)] leading-[22px] text-[var(--fg-muted)]">
          서로 선택한 사람은 연결 목록에서 확인할 수 있어요. 여기서는 대화나 상세 정보를 열 수 없어요.
        </p>
        <Link className={`${chromePrimaryButtonClassName} mt-6`} href="/connections">
          연결 목록으로
        </Link>
      </section>
    </ScreenShell>
  );
}
