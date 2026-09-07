import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiProblemError, type BungaeApi } from "@/lib/api/client";
import { AuthSessionProvider } from "@/lib/auth/auth-session-provider";
import type { ConnectionPage } from "@/lib/api/types";

import {
  anotherUser,
  AuthenticatedTestRoot,
  createApi,
  deferred,
  getLatestSession,
  user,
} from "../meetups/[meetupId]/action-page-test-utils";
import ConnectionsPage from "./page";

const connection = (connectionId: string, displayName: string) => ({
  connectionId,
  counterpart: { userId: `${connectionId}-user`, displayName },
  matchedAt: "2026-09-07T10:00:00Z",
});

function apiProblem(detail: string) {
  return new ApiProblemError(422, {
    type: "https://bungae.example/problems/invalid",
    title: "Invalid request",
    status: 422,
    detail,
    instance: "/v1/connections",
    code: "INVALID",
    traceId: "trace-1",
  });
}

function accountAwareApi(overrides: Partial<BungaeApi> = {}) {
  return createApi({
    createSession: vi.fn().mockImplementation(({ requestId }) => Promise.resolve({
      accessToken: `access-${requestId}`,
      refreshToken: `refresh-${requestId}`,
      expiresIn: 900,
      user: requestId === anotherUser.id ? anotherUser : user,
    })),
    ...overrides,
  });
}

async function switchToAnotherAccount() {
  await act(async () => {
    await getLatestSession().createSession({ requestId: anotherUser.id, otp: "123456" });
  });
}

describe("ConnectionsPage", () => {
  it("requires authentication without issuing a connection request", async () => {
    const api = createApi();
    render(<AuthSessionProvider api={api}><ConnectionsPage /></AuthSessionProvider>);

    expect(await screen.findByRole("alert")).toHaveTextContent("로그인 후 연결을 확인할 수 있어요.");
    expect(api.listConnections).not.toHaveBeenCalled();
  });

  it("shows loading before the authenticated empty response", async () => {
    const connections = deferred<ConnectionPage>();
    const api = createApi({ listConnections: vi.fn().mockReturnValue(connections.promise) });
    render(<AuthenticatedTestRoot api={api}><ConnectionsPage /></AuthenticatedTestRoot>);

    expect(await screen.findByRole("status")).toHaveTextContent("연결을 불러오는 중이에요.");
    await act(async () => connections.resolve({ items: [] }));
    expect(await screen.findByText("아직 연결된 사람이 없어요.")).toBeInTheDocument();
  });

  it("retries both API-problem and generic initial-load errors", async () => {
    const api = createApi({
      listConnections: vi.fn()
        .mockRejectedValueOnce(apiProblem("연결 열람 권한이 없어요."))
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValue({ items: [] }),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionsPage /></AuthenticatedTestRoot>);

    expect(await screen.findByRole("alert")).toHaveTextContent("연결 열람 권한이 없어요.");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("연결을 불러오지 못했어요.");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("아직 연결된 사람이 없어요.")).toBeInTheDocument();
  });

  it("appends a cursor page once and deduplicates connections", async () => {
    const api = createApi({
      listConnections: vi.fn()
        .mockResolvedValueOnce({ items: [connection("one", "서윤")], nextCursor: "next" })
        .mockResolvedValueOnce({ items: [connection("one", "서윤"), connection("two", "하늘")] }),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionsPage /></AuthenticatedTestRoot>);

    await screen.findByText("서윤");
    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
    expect(await screen.findByText("하늘")).toBeInTheDocument();
    expect(screen.getAllByText("서윤")).toHaveLength(1);
    expect(api.listConnections).toHaveBeenLastCalledWith({ cursor: "next", limit: 20 }, "access");
  });

  it("retries an append failure with the preserved cursor", async () => {
    const api = createApi({
      listConnections: vi.fn()
        .mockResolvedValueOnce({ items: [connection("one", "서윤")], nextCursor: "next" })
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce({ items: [connection("two", "하늘")] }),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionsPage /></AuthenticatedTestRoot>);

    await screen.findByText("서윤");
    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("연결을 더 불러오지 못했어요.");
    fireEvent.click(screen.getByRole("button", { name: "더 보기 재시도" }));
    expect(await screen.findByText("하늘")).toBeInTheDocument();
    expect(api.listConnections).toHaveBeenLastCalledWith({ cursor: "next", limit: 20 }, "access");
  });

  it("renders only the connection DTO without guessing a meetup", async () => {
    const api = createApi({ listConnections: vi.fn().mockResolvedValue({ items: [connection("one", "서윤")] }) });
    render(<AuthenticatedTestRoot api={api}><ConnectionsPage /></AuthenticatedTestRoot>);

    expect(await screen.findByText("서윤")).toBeInTheDocument();
    expect(screen.getByText("2026-09-07T10:00:00Z")).toHaveAttribute("dateTime", "2026-09-07T10:00:00Z");
    expect(screen.queryByText("한강 산책")).not.toBeInTheDocument();
  });

  it("supports reduced-motion dialog Escape and cancel focus restoration", async () => {
    window.__setReducedMotionPreference(true);
    const api = createApi({ listConnections: vi.fn().mockResolvedValue({ items: [connection("one", "서윤")] }) });
    render(<AuthenticatedTestRoot api={api}><ConnectionsPage /></AuthenticatedTestRoot>);

    const trigger = await screen.findByRole("button", { name: "서윤님과 연결 종료" });
    fireEvent.click(trigger);
    await screen.findByRole("dialog", { name: "연결을 종료할까요?" });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("button", { name: "취소" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    window.__setReducedMotionPreference(false);
  });

  it("retains a row until DELETE 204 and ignores duplicate confirmation", async () => {
    const deleting = deferred<void>();
    const api = createApi({
      listConnections: vi.fn().mockResolvedValue({ items: [connection("one", "서윤")] }),
      deleteConnection: vi.fn().mockReturnValue(deleting.promise),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionsPage /></AuthenticatedTestRoot>);

    fireEvent.click(await screen.findByRole("button", { name: "서윤님과 연결 종료" }));
    fireEvent.click(await screen.findByRole("button", { name: "연결 종료" }));
    expect(screen.getByText("서윤")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "종료 중..." }));
    await waitFor(() => expect(api.deleteConnection).toHaveBeenCalledTimes(1));
    await act(async () => deleting.resolve());
    expect(await screen.findByText("아직 연결된 사람이 없어요.")).toBeInTheDocument();
  });

  it("retries API-problem and generic DELETE errors", async () => {
    const api = createApi({
      listConnections: vi.fn().mockResolvedValue({ items: [connection("one", "서윤")] }),
      deleteConnection: vi.fn()
        .mockRejectedValueOnce(apiProblem("연결 종료 권한이 없어요."))
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce(undefined),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionsPage /></AuthenticatedTestRoot>);

    fireEvent.click(await screen.findByRole("button", { name: "서윤님과 연결 종료" }));
    fireEvent.click(await screen.findByRole("button", { name: "연결 종료" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("연결 종료 권한이 없어요.");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("연결을 종료하지 못했어요. 다시 시도해 주세요.");
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("아직 연결된 사람이 없어요.")).toBeInTheDocument();
    expect(api.deleteConnection).toHaveBeenCalledTimes(3);
  });

  it("focuses the next connection action after a successful delete", async () => {
    const api = createApi({
      listConnections: vi.fn().mockResolvedValue({ items: [connection("one", "서윤"), connection("two", "하늘")] }),
      deleteConnection: vi.fn().mockResolvedValue(undefined),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionsPage /></AuthenticatedTestRoot>);

    fireEvent.click(await screen.findByRole("button", { name: "서윤님과 연결 종료" }));
    fireEvent.click(await screen.findByRole("button", { name: "연결 종료" }));
    const nextAction = await screen.findByRole("button", { name: "하늘님과 연결 종료" });
    await waitFor(() => expect(nextAction).toHaveFocus());
  });

  it("focuses the count after deleting the final connection", async () => {
    const api = createApi({
      listConnections: vi.fn().mockResolvedValue({ items: [connection("one", "서윤")] }),
      deleteConnection: vi.fn().mockResolvedValue(undefined),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionsPage /></AuthenticatedTestRoot>);

    fireEvent.click(await screen.findByRole("button", { name: "서윤님과 연결 종료" }));
    fireEvent.click(await screen.findByRole("button", { name: "연결 종료" }));
    const count = await screen.findByRole("heading", { name: "연결된 사람 0명" });
    await waitFor(() => expect(count).toHaveFocus());
  });

  it("ignores a stale A list completion after account B becomes active", async () => {
    const first = deferred<ConnectionPage>();
    const api = accountAwareApi({
      listConnections: vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockResolvedValueOnce({ items: [connection("b", "B의 연결")] }),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionsPage /></AuthenticatedTestRoot>);
    await waitFor(() => expect(api.listConnections).toHaveBeenCalledTimes(1));

    await switchToAnotherAccount();
    await waitFor(() => expect(api.listConnections).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("B의 연결")).toBeInTheDocument();
    await act(async () => first.resolve({ items: [connection("a", "A의 연결")] }));
    expect(screen.queryByText("A의 연결")).not.toBeInTheDocument();
  });

  it("ignores a stale A append error after account B becomes active", async () => {
    const more = deferred<ConnectionPage>();
    const api = accountAwareApi({
      listConnections: vi.fn()
        .mockResolvedValueOnce({ items: [connection("a", "A의 연결")], nextCursor: "next" })
        .mockReturnValueOnce(more.promise)
        .mockResolvedValueOnce({ items: [connection("b", "B의 연결")] }),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionsPage /></AuthenticatedTestRoot>);

    await screen.findByText("A의 연결");
    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
    await switchToAnotherAccount();
    await waitFor(() => expect(api.listConnections).toHaveBeenCalledTimes(3));
    expect(await screen.findByText("B의 연결")).toBeInTheDocument();
    await act(async () => more.reject(new Error("old failure")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ignores a stale A DELETE success after account B becomes active", async () => {
    const deleting = deferred<void>();
    const api = accountAwareApi({
      listConnections: vi.fn()
        .mockResolvedValueOnce({ items: [connection("a", "A의 연결")] })
        .mockResolvedValueOnce({ items: [connection("b", "B의 연결")] }),
      deleteConnection: vi.fn().mockReturnValue(deleting.promise),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionsPage /></AuthenticatedTestRoot>);

    fireEvent.click(await screen.findByRole("button", { name: "A의 연결님과 연결 종료" }));
    fireEvent.click(await screen.findByRole("button", { name: "연결 종료" }));
    await switchToAnotherAccount();
    await waitFor(() => expect(api.listConnections).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("B의 연결")).toBeInTheDocument();
    await act(async () => deleting.resolve());
    expect(screen.getByText("B의 연결")).toBeInTheDocument();
    expect(screen.queryByText("A의 연결님과의 연결을 종료했어요.")).not.toBeInTheDocument();
  });

  it("ignores a stale A DELETE error after account B becomes active", async () => {
    const deleting = deferred<never>();
    const api = accountAwareApi({
      listConnections: vi.fn()
        .mockResolvedValueOnce({ items: [connection("a", "A의 연결")] })
        .mockResolvedValueOnce({ items: [connection("b", "B의 연결")] }),
      deleteConnection: vi.fn().mockReturnValue(deleting.promise),
    });
    render(<AuthenticatedTestRoot api={api}><ConnectionsPage /></AuthenticatedTestRoot>);

    fireEvent.click(await screen.findByRole("button", { name: "A의 연결님과 연결 종료" }));
    fireEvent.click(await screen.findByRole("button", { name: "연결 종료" }));
    await switchToAnotherAccount();
    await waitFor(() => expect(api.listConnections).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("B의 연결")).toBeInTheDocument();
    await act(async () => deleting.reject(new Error("old failure")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
