import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiProblemError } from "@/lib/api/client";
import AttendancePage from "./page";
import {
  anotherUser,
  AuthenticatedTestRoot,
  createApi,
  deferred,
  getLatestSession,
  renderAuthenticated,
  user,
} from "../action-page-test-utils";

let routeMeetupId = "meetup/with space";
vi.mock("next/navigation", () => ({ useParams: () => ({ meetupId: routeMeetupId }) }));

const appeal = { id: "appeal-1", attendanceId: "attendance-1", meetupId: "meetup/with space", userId: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c", reason: "기록이 정확하지 않아요.", state: "SUBMITTED" as const, submittedAt: "2026-09-08T00:00:00Z", deadlineAt: "2026-09-15T00:00:00Z", reviewedBy: null, resolution: null, reviewedAt: null, createdAt: "2026-09-08T00:00:00Z", updatedAt: "2026-09-08T00:00:00Z", version: 0, evidenceIds: [] };

beforeEach(() => {
  routeMeetupId = "meetup/with space";
});

describe("AttendancePage", () => {
  it("shows and focuses a receipt only after the resolved 201-backed response, while deduplicating the pending submission", async () => {
    const request = deferred<typeof appeal>();
    const createNoShowAppeal = vi.fn().mockReturnValue(request.promise);
    const api = createApi({ createNoShowAppeal });
    renderAuthenticated(<AttendancePage />, api);

    await screen.findByRole("heading", { name: "노쇼 결정 이의 접수" });
    expect(screen.queryByText("출석 이의 접수 기능을 준비 중이에요")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이의 접수" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: appeal.reason } });
    const submit = screen.getByRole("button", { name: "이의 접수" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(createNoShowAppeal).toHaveBeenCalledOnce());
    expect(screen.queryByText("이의가 접수됐어요")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "접수 중" })).toBeDisabled();
    expect(createNoShowAppeal).toHaveBeenCalledWith("meetup/with space", { reason: appeal.reason }, "access");

    await act(async () => request.resolve(appeal));
    expect(await screen.findByText("이의가 접수됐어요")).toBeInTheDocument();
    const receipt = screen.getByRole("status");
    expect(receipt).toHaveTextContent("처리 상태: 접수됨");
    expect(receipt).not.toHaveTextContent("SUBMITTED");
    expect(receipt).toHaveFocus();
  });

  it("keeps generic API failures visible and retryable without asserting attendance state", async () => {
    const api = createApi({ createNoShowAppeal: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(appeal) });
    renderAuthenticated(<AttendancePage />, api);
    await screen.findByRole("heading", { name: "노쇼 결정 이의 접수" });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: appeal.reason } });
    fireEvent.click(screen.getByRole("button", { name: "이의 접수" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("이의 접수를 완료하지 못했어요");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByText("이의가 접수됐어요");
    expect(api.createNoShowAppeal).toHaveBeenCalledTimes(2);
  });

  it("keeps a 409 problem visible and retryable", async () => {
    const api = createApi({ createNoShowAppeal: vi.fn().mockRejectedValueOnce(new ApiProblemError(409, null)).mockResolvedValueOnce(appeal) });
    renderAuthenticated(<AttendancePage />, api);
    await screen.findByRole("heading", { name: "노쇼 결정 이의 접수" });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: appeal.reason } });
    fireEvent.click(screen.getByRole("button", { name: "이의 접수" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("이의 접수를 완료하지 못했어요");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByText("이의가 접수됐어요");
  });

  it("blocks unauthenticated direct access without creating an appeal", () => {
    render(<AttendancePage />);

    expect(screen.getByText("로그인한 계정에서만 이의를 접수할 수 있어요")).toBeInTheDocument();
    expect(screen.queryByText("이의가 접수됐어요")).not.toBeInTheDocument();
  });

  it("accepts a 2,000-character reason and rejects a 2,001-character reason without another request", async () => {
    const createNoShowAppeal = vi.fn().mockRejectedValue(new Error("offline"));
    const api = createApi({ createNoShowAppeal });
    renderAuthenticated(<AttendancePage />, api);

    const textbox = await screen.findByRole("textbox");
    fireEvent.change(textbox, { target: { value: "가".repeat(2000) } });
    fireEvent.click(screen.getByRole("button", { name: "이의 접수" }));
    await screen.findByRole("alert");
    expect(createNoShowAppeal).toHaveBeenCalledWith("meetup/with space", { reason: "가".repeat(2000) }, "access");

    fireEvent.change(textbox, { target: { value: "가".repeat(2001) } });
    fireEvent.click(screen.getByRole("button", { name: "이의 접수" }));
    expect(screen.getByRole("alert")).toHaveTextContent("이의 사유는 2,000자 이하여야 해요.");
    expect(createNoShowAppeal).toHaveBeenCalledOnce();
  });

  it("suppresses a late old-route appeal success", async () => {
    const request = deferred<typeof appeal>();
    const api = createApi({ createNoShowAppeal: vi.fn().mockReturnValue(request.promise) });
    const view = renderAuthenticated(<AttendancePage />, api);

    fireEvent.change(await screen.findByRole("textbox"), { target: { value: appeal.reason } });
    fireEvent.click(screen.getByRole("button", { name: "이의 접수" }));
    routeMeetupId = "replacement";
    view.rerender(<AuthenticatedTestRoot api={api}><AttendancePage /></AuthenticatedTestRoot>);
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(""));

    await act(async () => request.resolve(appeal));
    expect(screen.queryByText("이의가 접수됐어요")).not.toBeInTheDocument();
  });

  it("suppresses a late old-route appeal error", async () => {
    const request = deferred<typeof appeal>();
    const api = createApi({ createNoShowAppeal: vi.fn().mockReturnValue(request.promise) });
    const view = renderAuthenticated(<AttendancePage />, api);

    fireEvent.change(await screen.findByRole("textbox"), { target: { value: appeal.reason } });
    fireEvent.click(screen.getByRole("button", { name: "이의 접수" }));
    routeMeetupId = "replacement";
    view.rerender(<AuthenticatedTestRoot api={api}><AttendancePage /></AuthenticatedTestRoot>);
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(""));

    await act(async () => request.reject(new Error("old route failure")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("suppresses a late old-account appeal success", async () => {
    const request = deferred<typeof appeal>();
    const api = createApi({
      createSession: vi.fn(({ requestId }) => Promise.resolve({
        accessToken: requestId === anotherUser.id ? "access-b" : "access",
        refreshToken: "refresh",
        expiresIn: 900,
        user: requestId === anotherUser.id ? anotherUser : user,
      })),
      createNoShowAppeal: vi.fn().mockReturnValue(request.promise),
    });
    renderAuthenticated(<AttendancePage />, api);

    fireEvent.change(await screen.findByRole("textbox"), { target: { value: appeal.reason } });
    fireEvent.click(screen.getByRole("button", { name: "이의 접수" }));
    await act(async () => { await getLatestSession().createSession({ requestId: anotherUser.id, otp: "654321" }); });
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(""));

    await act(async () => request.resolve(appeal));
    expect(screen.queryByText("이의가 접수됐어요")).not.toBeInTheDocument();
  });

  it("suppresses a late old-account appeal error", async () => {
    const request = deferred<typeof appeal>();
    const api = createApi({
      createSession: vi.fn(({ requestId }) => Promise.resolve({
        accessToken: requestId === anotherUser.id ? "access-b" : "access",
        refreshToken: "refresh",
        expiresIn: 900,
        user: requestId === anotherUser.id ? anotherUser : user,
      })),
      createNoShowAppeal: vi.fn().mockReturnValue(request.promise),
    });
    renderAuthenticated(<AttendancePage />, api);

    fireEvent.change(await screen.findByRole("textbox"), { target: { value: appeal.reason } });
    fireEvent.click(screen.getByRole("button", { name: "이의 접수" }));
    await act(async () => { await getLatestSession().createSession({ requestId: anotherUser.id, otp: "654321" }); });
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(""));

    await act(async () => request.reject(new Error("old account failure")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("suppresses a late appeal receipt after the same subject logs out and back in", async () => {
    const request = deferred<typeof appeal>();
    const api = createApi({
      createSession: vi.fn(({ requestId }) =>
        requestId === user.id
          ? Promise.resolve({ accessToken: "access", refreshToken: "refresh", expiresIn: 900, user })
          : Promise.resolve({ accessToken: "access-2", refreshToken: "refresh-2", expiresIn: 900, user }),
      ),
      createNoShowAppeal: vi.fn().mockReturnValue(request.promise),
    });
    const view = renderAuthenticated(<AttendancePage />, api);

    fireEvent.change(await screen.findByRole("textbox"), { target: { value: appeal.reason } });
    fireEvent.click(screen.getByRole("button", { name: "이의 접수" }));

    await act(async () => {
      await getLatestSession().logout();
    });
    await screen.findByRole("heading", { name: "로그인한 계정에서만 이의를 접수할 수 있어요" });
    await act(async () => {
      await getLatestSession().createSession({ requestId: user.id, otp: "654321" });
    });
    await screen.findByRole("heading", { name: "노쇼 결정 이의 접수" });

    await act(async () => request.resolve(appeal));
    expect(screen.queryByText("이의가 접수됐어요")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    view.unmount();
  });

  it("blocks an offline appeal submission and re-enables after reconnect, keeping the draft", async () => {
    const createNoShowAppeal = vi.fn();
    const api = createApi({ createNoShowAppeal });
    renderAuthenticated(<AttendancePage />, api);
    const textbox = await screen.findByRole("textbox");
    fireEvent.change(textbox, { target: { value: appeal.reason } });

    act(() => setOnline(false));
    expect(screen.getByText("인터넷 연결이 끊겼어요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이의 접수" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "이의 접수" }));
    expect(createNoShowAppeal).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox")).toHaveValue(appeal.reason);

    act(() => setOnline(true));
    const submit = screen.getByRole("button", { name: "이의 접수" });
    await waitFor(() => expect(submit).toBeEnabled());
    expect(createNoShowAppeal).not.toHaveBeenCalled();
  });
});

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}
