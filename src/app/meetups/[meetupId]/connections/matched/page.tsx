"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { ScreenShell } from "@/components/screen-shell";
import { TopNavigation } from "@/components/top-navigation";

export default function MatchedConnectionPage() {
  const params = useParams<{ meetupId: string }>();
  const meetupId = typeof params.meetupId === "string" ? params.meetupId : "";
  return <ScreenShell className="px-5 pb-8"><TopNavigation href={`/meetups/${encodeURIComponent(meetupId)}`} title={<span>연결 안내</span>} /><main><h1>연결 상세는 아직 제공되지 않아요.</h1><p>이 경로에는 connectionId도 연결 상세 조회 계약도 없어요. 실제 상호 연결은 연결 목록에서 확인해 주세요.</p><Link href="/connections">연결 목록으로</Link><p>메시지와 실시간 기능은 connectionId 기반 계약이 필요해요.</p></main></ScreenShell>;
}
