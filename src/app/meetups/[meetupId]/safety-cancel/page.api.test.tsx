import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiProblemError } from "@/lib/api/client";

import { actionMeetup, anotherUser, AuthenticatedTestRoot, createApi, deferred, getLatestSession, meetup, renderAuthenticated, user } from "../action-page-test-utils";
import SafetyCancelPage from "./page";
let routeMeetupId = "demo";
vi.mock("next/navigation", () => ({ useParams: () => ({ meetupId: routeMeetupId }) }));

function enterReason(reason = "안전 우려") {
  fireEvent.change(screen.getByLabelText("안전 취소 사유"), { target: { value: reason } });
}

async function submit() {
  const button = screen.getByRole("button", { name: "안전 사유로 모임 취소하기" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

function apiProblem(status: number, detail: string) {
  return new ApiProblemError(status, { type: "https://bungae.example/problem", title: "취소 실패", status, detail, instance: "/v1/meetups/demo/cancel", code: "CANCEL_FAILED", traceId: "trace-1" });
}

describe("SafetyCancelPage API behavior", () => {
  beforeEach(() => { routeMeetupId = "demo"; vi.restoreAllMocks(); });

  it("denies an unauthenticated direct URL without a mutation", () => {
    const api = createApi();
    render(<SafetyCancelPage />);
    expect(screen.getByText("로그인한 뒤 모임 취소 가능 여부를 확인해 주세요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "안전 사유로 모임 취소하기" })).toBeDisabled();
    expect(api.cancelMeetup).not.toHaveBeenCalled();
  });

  it("denies an authenticated direct URL when CANCEL is absent", async () => {
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue(meetup) });
    renderAuthenticated(<SafetyCancelPage />, api);
    expect(await screen.findByText("현재 이 모임을 취소할 수 없어요.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "안전 사유로 모임 취소하기" })).toBeDisabled();
    expect(api.cancelMeetup).not.toHaveBeenCalled();
  });

  it("does not show a receipt before the server response, deduplicates in flight, then shows success", async () => {
    const response = deferred<typeof meetup>();
    const cancelMeetup = vi.fn().mockReturnValue(response.promise);
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue(actionMeetup("CANCEL")), cancelMeetup });
    renderAuthenticated(<SafetyCancelPage />, api);
    await screen.findByLabelText("안전 취소 사유");
    enterReason();
    const button = screen.getByRole("button", { name: "안전 사유로 모임 취소하기" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(cancelMeetup).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: "취소 접수됐어요" })).not.toBeInTheDocument();
    await act(async () => { response.resolve({ ...actionMeetup("CANCEL"), state: "CANCELLED" }); });
    expect(await screen.findByRole("heading", { name: "취소 접수됐어요" })).toBeInTheDocument();
  });

  it("surfaces generic and API failures and reuses the same key for an unchanged reason", async () => {
    const cancelMeetup = vi.fn().mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(apiProblem(503, "서버가 취소를 처리하지 못했어요."));
    vi.spyOn(crypto, "randomUUID").mockReturnValue("same-key");
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue(actionMeetup("CANCEL")), cancelMeetup });
    renderAuthenticated(<SafetyCancelPage />, api);
    await screen.findByLabelText("안전 취소 사유");
    enterReason();
    await submit();
    expect(await screen.findByText("모임 취소를 접수하지 못했어요. 다시 시도해 주세요.")).toBeInTheDocument();
    await submit();
    expect(await screen.findByText("서버가 취소를 처리하지 못했어요.")).toBeInTheDocument();
    expect(cancelMeetup.mock.calls.map((call) => call[2])).toEqual(["same-key", "same-key"]);
  });

  it("rolls over the idempotency key when the reason changes", async () => {
    const cancelMeetup = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ ...actionMeetup("CANCEL"), state: "CANCELLED" });
    vi.spyOn(crypto, "randomUUID").mockReturnValueOnce("first-key").mockReturnValueOnce("edited-key");
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue(actionMeetup("CANCEL")), cancelMeetup });
    renderAuthenticated(<SafetyCancelPage />, api);
    await screen.findByLabelText("안전 취소 사유");
    enterReason("첫 사유");
    await submit();
    await screen.findByText("모임 취소를 접수하지 못했어요. 다시 시도해 주세요.");
    enterReason("수정 사유");
    await submit();
    expect(await screen.findByRole("heading", { name: "취소 접수됐어요" })).toBeInTheDocument();
    expect(cancelMeetup.mock.calls.map((call) => call[2])).toEqual(["first-key", "edited-key"]);
  });

  it("ignores a stale route completion", async () => {
    const response = deferred<typeof meetup>();
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue(actionMeetup("CANCEL")), cancelMeetup: vi.fn().mockReturnValue(response.promise) });
    const view = renderAuthenticated(<SafetyCancelPage />, api);
    await screen.findByLabelText("안전 취소 사유");
    enterReason();
    await submit();
    routeMeetupId = "replacement";
    view.rerender(<AuthenticatedTestRoot api={api}><SafetyCancelPage /></AuthenticatedTestRoot>);
    await act(async () => { response.resolve({ ...actionMeetup("CANCEL"), state: "CANCELLED" }); });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "취소 접수됐어요" })).not.toBeInTheDocument());
  });

  it("ignores a stale account completion and clears the action state", async () => {
    const response = deferred<typeof meetup>();
    const api = createApi({
      createSession: vi.fn().mockResolvedValueOnce({ accessToken: "old", refreshToken: "old-refresh", expiresIn: 900, user }).mockResolvedValueOnce({ accessToken: "new", refreshToken: "new-refresh", expiresIn: 900, user: anotherUser }),
      getMeetup: vi.fn().mockResolvedValue(actionMeetup("CANCEL")),
      cancelMeetup: vi.fn().mockReturnValue(response.promise),
    });
    renderAuthenticated(<SafetyCancelPage />, api);
    await screen.findByLabelText("안전 취소 사유");
    enterReason();
    await submit();
    await act(async () => { await getLatestSession().createSession({ requestId: anotherUser.id, otp: "654321" }); });
    await act(async () => { response.resolve({ ...actionMeetup("CANCEL"), state: "CANCELLED" }); });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "취소 접수됐어요" })).not.toBeInTheDocument());
    expect(screen.getByLabelText("안전 취소 사유")).toHaveValue("");
  });

  it("ignores a prior session's cancellation receipt after the same subject logs out and back in", async () => {
    const response = deferred<typeof meetup>();
    const api = createApi({
      createSession: vi.fn(() => Promise.resolve({
        accessToken: "access", refreshToken: "refresh", expiresIn: 900, user,
      })),
      getMeetup: vi.fn().mockResolvedValue(actionMeetup("CANCEL")),
      cancelMeetup: vi.fn().mockReturnValue(response.promise),
    });
    const view = renderAuthenticated(<SafetyCancelPage />, api);
    await screen.findByLabelText("안전 취소 사유");
    enterReason();
    await submit();

    await act(async () => {
      await getLatestSession().logout();
    });
    await screen.findByText("로그인한 뒤 모임 취소 가능 여부를 확인해 주세요.");
    await act(async () => {
      await getLatestSession().createSession({ requestId: user.id, otp: "654321" });
    });
    await screen.findByLabelText("안전 취소 사유");
    expect(screen.getByLabelText("안전 취소 사유")).toHaveValue("");

    await act(async () => { response.resolve({ ...actionMeetup("CANCEL"), state: "CANCELLED" }); });
    await waitFor(() => expect(screen.queryByRole("heading", { name: "취소 접수됐어요" })).not.toBeInTheDocument());
    view.unmount();
  });

  it("blocks an offline cancellation and re-enables after reconnect, keeping the draft", async () => {
    const cancelMeetup = vi.fn();
    const api = createApi({ getMeetup: vi.fn().mockResolvedValue(actionMeetup("CANCEL")), cancelMeetup });
    renderAuthenticated(<SafetyCancelPage />, api);
    await screen.findByLabelText("안전 취소 사유");
    enterReason();

    act(() => setOnline(false));
    expect(screen.getByText("인터넷 연결이 끊겼어요")).toBeInTheDocument();
    const submitButton = screen.getByRole("button", { name: "안전 사유로 모임 취소하기" });
    expect(submitButton).toBeDisabled();
    fireEvent.click(submitButton);
    expect(cancelMeetup).not.toHaveBeenCalled();
    expect(screen.getByLabelText("안전 취소 사유")).toHaveValue("안전 우려");

    act(() => setOnline(true));
    await waitFor(() => expect(screen.getByRole("button", { name: "안전 사유로 모임 취소하기" })).toBeEnabled());
    expect(cancelMeetup).not.toHaveBeenCalled();
  });
});

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}
