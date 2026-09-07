import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiProblemError } from "@/lib/api/client";

import { actionMeetup, anotherUser, AuthenticatedTestRoot, createApi, deferred, getLatestSession, meetup, renderAuthenticated, user } from "../action-page-test-utils";
import CheckInPage from "./page";

let routeMeetupId = "demo";
vi.mock("next/navigation", () => ({ useParams: () => ({ meetupId: routeMeetupId }) }));

function apiProblem(detail: string) {
  return new ApiProblemError(400, { type: "https://bungae.example/problem", title: "체크인 실패", status: 400, detail, instance: "/v1/meetups/demo/check-ins", code: "CHECK_IN_FAILED", traceId: "trace-1" });
}

async function enterCode(code: string) {
  fireEvent.change(await screen.findByLabelText("모임 코드"), { target: { value: code } });
}

async function submit() {
  const button = screen.getByRole("button", { name: "코드로 체크인하기" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

describe("CheckInPage API behavior", () => {
  beforeEach(() => { routeMeetupId = "demo"; vi.restoreAllMocks(); });

  it("denies an unauthenticated direct URL without a mutation", () => {
    const api = createApi();
    render(<CheckInPage />);
    expect(screen.getByText("로그인한 뒤 체크인 가능 여부를 확인해 주세요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "코드로 체크인하기" })).toBeDisabled();
    expect(api.checkInMeetup).not.toHaveBeenCalled();
  });

  it("denies an authenticated direct URL when CHECK_IN is absent", async () => {
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue(meetup) });
    renderAuthenticated(<CheckInPage />, api);
    expect(await screen.findByText("현재 이 모임에 체크인할 수 없어요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "코드로 체크인하기" })).toBeDisabled();
    expect(api.checkInMeetup).not.toHaveBeenCalled();
  });

  it("does not show success before 201, deduplicates in flight, and renders success after it", async () => {
    const response = deferred<{ participationId: string; state: "CHECKED_IN"; checkedInAt: string }>();
    const checkInMeetup = vi.fn().mockReturnValue(response.promise);
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue(actionMeetup("CHECK_IN")), checkInMeetup });
    renderAuthenticated(<CheckInPage />, api);
    await enterCode("A");
    const button = screen.getByRole("button", { name: "코드로 체크인하기" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(checkInMeetup).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: "체크인됐어요" })).not.toBeInTheDocument();
    await act(async () => { response.resolve({ participationId: "participant", state: "CHECKED_IN", checkedInAt: "2026-09-07T10:00:00.000Z" }); });
    expect(await screen.findByRole("heading", { name: "체크인됐어요" })).toBeInTheDocument();
  });

  it("accepts the one and sixty-four character API boundaries", async () => {
    const checkInMeetup = vi.fn().mockRejectedValueOnce(new Error("retry")).mockResolvedValue({ participationId: "participant", state: "CHECKED_IN", checkedInAt: "2026-09-07T10:00:00.000Z" });
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue(actionMeetup("CHECK_IN")), checkInMeetup });
    renderAuthenticated(<CheckInPage />, api);
    await enterCode("A");
    await submit();
    await screen.findByText("체크인을 처리하지 못했어요. 다시 시도해 주세요.");
    const maxCode = "A".repeat(64);
    await enterCode(maxCode);
    await submit();
    expect(await screen.findByRole("heading", { name: "체크인됐어요" })).toBeInTheDocument();
    expect(checkInMeetup.mock.calls.map((call) => call[1].code)).toEqual(["A", maxCode]);
  });

  it("surfaces generic and API errors, reuses same-code retry keys, and rolls over an edited code key", async () => {
    const checkInMeetup = vi.fn().mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(apiProblem("코드를 다시 확인해 주세요.")).mockResolvedValue({ participationId: "participant", state: "CHECKED_IN", checkedInAt: "2026-09-07T10:00:00.000Z" });
    vi.spyOn(crypto, "randomUUID").mockReturnValueOnce("same-key").mockReturnValueOnce("edited-key");
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue(actionMeetup("CHECK_IN")), checkInMeetup });
    renderAuthenticated(<CheckInPage />, api);
    await enterCode("FIRST");
    await submit();
    expect(await screen.findByText("체크인을 처리하지 못했어요. 다시 시도해 주세요.")).toBeInTheDocument();
    await submit();
    expect(await screen.findByText("코드를 다시 확인해 주세요.")).toBeInTheDocument();
    await enterCode("SECOND");
    await submit();
    expect(await screen.findByRole("heading", { name: "체크인됐어요" })).toBeInTheDocument();
    expect(checkInMeetup.mock.calls.map((call) => call[2])).toEqual(["same-key", "same-key", "edited-key"]);
  });

  it("ignores stale route completion", async () => {
    const response = deferred<{ participationId: string; state: "CHECKED_IN"; checkedInAt: string }>();
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue(actionMeetup("CHECK_IN")), checkInMeetup: vi.fn().mockReturnValue(response.promise) });
    const view = renderAuthenticated(<CheckInPage />, api);
    await enterCode("CODE");
    await submit();
    routeMeetupId = "replacement";
    view.rerender(<AuthenticatedTestRoot api={api}><CheckInPage /></AuthenticatedTestRoot>);
    await act(async () => { response.resolve({ participationId: "participant", state: "CHECKED_IN", checkedInAt: "2026-09-07T10:00:00.000Z" }); });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "체크인됐어요" })).not.toBeInTheDocument());
  });

  it("ignores stale account completion and clears code state", async () => {
    const response = deferred<{ participationId: string; state: "CHECKED_IN"; checkedInAt: string }>();
    const api = createApi({
      createSession: vi.fn().mockResolvedValueOnce({ accessToken: "old", refreshToken: "old-refresh", expiresIn: 900, user }).mockResolvedValueOnce({ accessToken: "new", refreshToken: "new-refresh", expiresIn: 900, user: anotherUser }),
      getMeetup: vi.fn().mockResolvedValue(actionMeetup("CHECK_IN")), checkInMeetup: vi.fn().mockReturnValue(response.promise),
    });
    renderAuthenticated(<CheckInPage />, api);
    await enterCode("CODE");
    await submit();
    await act(async () => { await getLatestSession().createSession({ requestId: anotherUser.id, otp: "654321" }); });
    await act(async () => { response.resolve({ participationId: "participant", state: "CHECKED_IN", checkedInAt: "2026-09-07T10:00:00.000Z" }); });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "체크인됐어요" })).not.toBeInTheDocument());
    expect(screen.getByLabelText("모임 코드")).toHaveValue("");
  });

  it("ignores a prior session's check-in receipt after the same subject logs out and back in", async () => {
    const response = deferred<{ participationId: string; state: "CHECKED_IN"; checkedInAt: string }>();
    const api = createApi({
      createSession: vi.fn(() => Promise.resolve({
        accessToken: "access", refreshToken: "refresh", expiresIn: 900, user,
      })),
      getMeetup: vi.fn().mockResolvedValue(actionMeetup("CHECK_IN")),
      checkInMeetup: vi.fn().mockReturnValue(response.promise),
    });
    const view = renderAuthenticated(<CheckInPage />, api);
    await enterCode("CODE");
    await submit();

    await act(async () => {
      await getLatestSession().logout();
    });
    await screen.findByText("로그인한 뒤 체크인 가능 여부를 확인해 주세요.");
    await act(async () => {
      await getLatestSession().createSession({ requestId: user.id, otp: "654321" });
    });
    await screen.findByLabelText("모임 코드");
    expect(screen.getByLabelText("모임 코드")).toHaveValue("");

    await act(async () => { response.resolve({ participationId: "participant", state: "CHECKED_IN", checkedInAt: "2026-09-07T10:00:00.000Z" }); });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "체크인됐어요" })).not.toBeInTheDocument());
    view.unmount();
  });

  it("blocks an offline check-in and re-enables after reconnect, keeping the code", async () => {
    const checkInMeetup = vi.fn();
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue(actionMeetup("CHECK_IN")), checkInMeetup });
    renderAuthenticated(<CheckInPage />, api);
    await enterCode("CODE");

    act(() => setOnline(false));
    expect(screen.getByText("인터넷 연결이 끊겼어요")).toBeInTheDocument();
    const submitButton = screen.getByRole("button", { name: "코드로 체크인하기" });
    expect(submitButton).toBeDisabled();
    fireEvent.click(submitButton);
    expect(checkInMeetup).not.toHaveBeenCalled();
    expect(screen.getByLabelText("모임 코드")).toHaveValue("CODE");

    act(() => setOnline(true));
    await waitFor(() => expect(screen.getByRole("button", { name: "코드로 체크인하기" })).toBeEnabled());
    expect(checkInMeetup).not.toHaveBeenCalled();
  });
});

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}
