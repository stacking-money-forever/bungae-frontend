import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthSessionProvider } from "@/lib/auth/auth-session-provider";

import AttendancePage from "./attendance/page";
import CheckInSuccessPage from "./check-in/success/page";
import JoinResultPage from "./join/page";
import MeetupDetailPage from "./page";
import QuorumUpdatePage from "./quorum-update/page";
import WaitlistResultPage from "./waitlist/page";
import NewMeetupPage from "../new/page";
import ProfilePage from "../../profile/page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ meetupId: "direct-entry" }),
}));

describe("P0 direct-entry contract gaps", () => {
  it("does not claim join success from a direct route", () => {
    render(<JoinResultPage />);

    expect(screen.getByRole("heading", { name: "참여 결과를 확인할 수 없어요" })).toBeInTheDocument();
    expect(screen.queryByText(/참여했어요/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "모임 상세에서 확인하기" })).toHaveAttribute("href", "/meetups/direct-entry");
  });

  it("does not claim waitlist success or a position from a direct route", () => {
    render(<WaitlistResultPage />);

    expect(screen.getByRole("heading", { name: "대기 등록 결과를 확인할 수 없어요" })).toBeInTheDocument();
    expect(screen.queryByText("대기 순서에 등록됐어요")).not.toBeInTheDocument();
  });

  it("does not claim check-in success from a direct route", () => {
    render(<CheckInSuccessPage />);

    expect(screen.getByRole("heading", { name: "체크인 결과를 확인할 수 없어요" })).toBeInTheDocument();
    expect(screen.queryByText("체크인했어요")).not.toBeInTheDocument();
  });

  it("keeps a direct attendance route anonymous until an authenticated API submission", () => {
    render(<AttendancePage />);

    expect(screen.getByRole("heading", { name: "로그인한 계정에서만 이의를 접수할 수 있어요" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "이의 접수" })).not.toBeInTheDocument();
    expect(screen.queryByText("이의가 접수됐어요")).not.toBeInTheDocument();
  });

  it("keeps direct quorum routes out of local cancellation and completion states", () => {
    render(<QuorumUpdatePage />);

    expect(screen.getByRole("heading", { name: "최신 모임 상태를 확인해 주세요" })).toBeInTheDocument();
    expect(screen.queryByText("참여를 취소했어요")).not.toBeInTheDocument();
  });

  it("keeps posted, join, and success queries from creating anonymous demo results", () => {
    window.history.replaceState({}, "", "/meetups/new?posted=1&join=1&success=1");
    const view = render(<NewMeetupPage />);

    expect(screen.getByRole("heading", { name: "로그인하고 모임을 만들어 주세요" })).toBeInTheDocument();
    expect(screen.queryByText("모임을 게시했어요")).not.toBeInTheDocument();

    view.unmount();
    render(<MeetupDetailPage />);
    expect(screen.getByRole("heading", { name: "로그인하고 모임을 확인해 주세요" })).toBeInTheDocument();
    expect(screen.queryByText("퇴근 후 한강 산책")).not.toBeInTheDocument();
  });

  it("keeps the anonymous profile behind login even with a success query", () => {
    window.history.replaceState({}, "", "/profile?success=1");
    render(<AuthSessionProvider><ProfilePage /></AuthSessionProvider>);

    expect(screen.getByRole("heading", { name: "로그인하고 프로필을 확인해 주세요" })).toBeInTheDocument();
    expect(screen.queryByText("마포구 망원동")).not.toBeInTheDocument();
  });
});
