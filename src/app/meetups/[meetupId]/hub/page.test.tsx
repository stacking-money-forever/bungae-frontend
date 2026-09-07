import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiProblemError } from "@/lib/api/client";

import {
  anotherUser,
  AuthenticatedTestRoot,
  createApi,
  deferred,
  getLatestSession,
  meetup,
  renderAuthenticated,
  user,
} from "../action-page-test-utils";

import MeetupHubPage from "./page";

let routeMeetupId = "demo";

vi.mock("next/navigation", () => ({
  useParams: () => ({ meetupId: routeMeetupId }),
}));

describe("MeetupHubPage", () => {
  beforeEach(() => {
    routeMeetupId = "demo";
    vi.restoreAllMocks();
  });

  it("requires authentication instead of displaying fixture meeting data", () => {
    render(<MeetupHubPage />);

    expect(screen.getByRole("heading", { name: "로그인하고 모임 상태를 확인해 주세요" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "휴대전화로 로그인하기" })).toHaveAttribute("href", "/auth");
    expect(screen.queryByText("망원한강공원 3번 출입구")).not.toBeInTheDocument();
  });

  it("renders only fresh DTO fields, preserves redacted venue, and gates links by allowedActions", async () => {
    const getMeetup = vi.fn().mockResolvedValue({
      ...meetup,
      title: "서버 확정 산책",
      joinedCount: 3,
      minimumParticipants: 2,
      capacity: 5,
      venue: {},
      allowedActions: ["CHECK_IN", "LEAVE"] as const,
    });
    const api = createApi({ getMeetup });

    renderAuthenticated(<MeetupHubPage />, api);

    expect(await screen.findByRole("heading", { name: "서버 확정 산책" })).toBeInTheDocument();
    expect(getMeetup).toHaveBeenCalledWith("demo", "access");
    expect(screen.getByText("현재 3명 · 최소 2명 · 정원 5명")).toBeInTheDocument();
    expect(screen.getByText("정확한 장소는 서버가 이 계정에 공개한 경우에만 표시해요.")).toBeInTheDocument();
    expect(screen.queryByText("망원한강공원 3번 출입구")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /체크인하기/ })).toHaveAttribute("href", "/meetups/demo/check-in");
    expect(screen.getByRole("link", { name: /참여 취소하기/ })).toHaveAttribute("href", "/meetups/demo");
    expect(screen.queryByRole("link", { name: /안전을 위해 모임 취소하기/ })).not.toBeInTheDocument();
  });

  it("shows a retryable fresh-detail failure without falling back to fixtures", async () => {
    const getMeetup = vi
      .fn()
      .mockRejectedValueOnce(new ApiProblemError(503, { type: "about:blank", title: "Unavailable", status: 503, detail: "잠시 후 다시 시도해 주세요.", instance: "/v1/meetups/demo", code: "UNAVAILABLE", traceId: "trace-1" }))
      .mockResolvedValueOnce({ ...meetup, title: "재시도 후 서버 모임" });
    const api = createApi({ getMeetup });

    renderAuthenticated(<MeetupHubPage />, api);

    expect(await screen.findByRole("alert")).toHaveTextContent("잠시 후 다시 시도해 주세요.");
    expect(screen.queryByText("퇴근 후 한강 산책")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("heading", { name: "재시도 후 서버 모임" })).toBeInTheDocument();
    expect(getMeetup).toHaveBeenCalledTimes(2);
  });

  it("ignores a stale route response before rendering the replacement route", async () => {
    const oldResponse = deferred<typeof meetup>();
    const getMeetup = vi.fn().mockReturnValueOnce(oldResponse.promise).mockResolvedValueOnce({ ...meetup, id: "replacement", title: "새 경로 서버 모임" });
    const api = createApi({ getMeetup });
    const view = renderAuthenticated(<MeetupHubPage />, api);

    await waitFor(() => expect(getMeetup).toHaveBeenCalledWith("demo", "access"));
    routeMeetupId = "replacement";
    view.rerender(<AuthenticatedTestRoot api={api}><MeetupHubPage /></AuthenticatedTestRoot>);
    await act(async () => {
      oldResponse.resolve({ ...meetup, title: "이전 경로 모임" });
      await Promise.resolve();
    });

    expect(await screen.findByRole("heading", { name: "새 경로 서버 모임" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "이전 경로 모임" })).not.toBeInTheDocument();
  });

  it("ignores a prior account's detail response", async () => {
    const oldResponse = deferred<typeof meetup>();
    const getMeetup = vi.fn().mockReturnValueOnce(oldResponse.promise).mockResolvedValueOnce({ ...meetup, title: "새 계정 서버 모임" });
    const api = createApi({
      createSession: vi.fn(({ requestId }) => Promise.resolve({
        accessToken: requestId === anotherUser.id ? "new-access" : "access",
        refreshToken: "refresh",
        expiresIn: 900,
        user: requestId === anotherUser.id ? anotherUser : user,
      })),
      getMeetup,
    });

    renderAuthenticated(<MeetupHubPage />, api);
    await waitFor(() => expect(getMeetup).toHaveBeenCalledWith("demo", "access"));
    await act(async () => {
      await getLatestSession().createSession({ requestId: anotherUser.id, otp: "654321" });
    });
    await act(async () => {
      oldResponse.resolve({ ...meetup, title: "이전 계정 모임" });
      await Promise.resolve();
    });

    expect(await screen.findByRole("heading", { name: "새 계정 서버 모임" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "이전 계정 모임" })).not.toBeInTheDocument();
  });

  it("ignores a prior session's detail response after the same subject logs out and back in", async () => {
    const oldResponse = deferred<typeof meetup>();
    const getMeetup = vi.fn()
      .mockReturnValueOnce(oldResponse.promise)
      .mockResolvedValue({ ...meetup, title: "새 세션 서버 모임" });
    const api = createApi({
      createSession: vi.fn(() => Promise.resolve({
        accessToken: "access", refreshToken: "refresh", expiresIn: 900, user,
      })),
      getMeetup,
    });
    renderAuthenticated(<MeetupHubPage />, api);
    await waitFor(() => expect(getMeetup).toHaveBeenCalledTimes(1));

    await act(async () => {
      await getLatestSession().logout();
    });
    await screen.findByRole("heading", { name: "로그인하고 모임 상태를 확인해 주세요" });
    await act(async () => {
      await getLatestSession().createSession({ requestId: user.id, otp: "654321" });
    });
    expect(await screen.findByRole("heading", { name: "새 세션 서버 모임" })).toBeInTheDocument();
    expect(getMeetup).toHaveBeenCalledTimes(2);

    await act(async () => {
      oldResponse.resolve({ ...meetup, title: "이전 세션 모임" });
      await Promise.resolve();
    });
    expect(screen.queryByRole("heading", { name: "이전 세션 모임" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "새 세션 서버 모임" })).toBeInTheDocument();
  });

  it("shows the offline hint on the fresh server surface without claiming server availability", async () => {
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue({ ...meetup, title: "서버 모임" }) });
    renderAuthenticated(<MeetupHubPage />, api);
    expect(await screen.findByRole("heading", { name: "서버 모임" })).toBeInTheDocument();
    expect(screen.queryByText("인터넷 연결이 끊겼어요")).not.toBeInTheDocument();

    act(() => setOnline(false));
    expect(screen.getByText("인터넷 연결이 끊겼어요")).toBeInTheDocument();
    expect(screen.getByText("지금은 변경을 저장하거나 서버 정보를 불러올 수 없어요. 연결이 돌아오면 다시 시도해 주세요.")).toBeInTheDocument();

    act(() => setOnline(true));
    await waitFor(() => expect(screen.queryByText("인터넷 연결이 끊겼어요")).not.toBeInTheDocument());
  });
});

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}
