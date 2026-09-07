import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiProblemError, type BungaeApi } from "@/lib/api/client";
import type { Block, BlockPage } from "@/lib/api/types";
import { AuthSessionProvider, type AuthSessionContextValue, useAuthSession } from "@/lib/auth/auth-session-provider";

import BlocksPage from "./page";

const userA = {
  id: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c",
  displayName: "민지",
  ageBand: "25_34" as const,
  interestCodes: ["WALK"],
  homeAreaCode: "MAPO",
  adultVerified: true,
  identityVerified: true,
  version: 1,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const userB = { ...userA, id: "b7c77e71-5b90-42f2-b9e1-8f6c8b1db76c" };
const blockA: Block = { blockedUserId: "blocked-a", createdAt: "2026-09-07T00:00:00.000Z" };
const blockB: Block = { blockedUserId: "blocked-b", createdAt: "2026-09-06T00:00:00.000Z" };

function createApi(overrides: Partial<BungaeApi> = {}): BungaeApi {
  return {
    requestOtp: vi.fn(),
    createSession: vi.fn().mockResolvedValue({ accessToken: "access-a", refreshToken: "refresh-a", expiresIn: 900, user: userA }),
    refreshSession: vi.fn(),
    getMe: vi.fn(),
    updateMe: vi.fn(),
    getActivityPolicies: vi.fn(),
    createVerificationSession: vi.fn(),
    listMeetups: vi.fn(),
    getMeetup: vi.fn(),
    createMeetup: vi.fn(),
    joinMeetup: vi.fn(),
    leaveMeetup: vi.fn(),
    cancelMeetup: vi.fn(),
    decideQuorum: vi.fn(),
    checkInMeetup: vi.fn(),
    listMyMeetups: vi.fn(),
    listNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    listMeetupMessages: vi.fn(),
    createMeetupMessage: vi.fn(),
    createReport: vi.fn(),
    createFeedback: vi.fn(),
    createImpressions: vi.fn(),
    createNextIntent: vi.fn(),
    listParticipants: vi.fn(),
    createConnectionIntent: vi.fn(),
    listConnections: vi.fn(),
    deleteConnection: vi.fn(),
    listBlocks: vi.fn().mockResolvedValue({ items: [] }),
    createBlock: vi.fn(),
    deleteBlock: vi.fn(),
    getWithdrawal: vi.fn(),
    scheduleWithdrawal: vi.fn(),
    cancelWithdrawal: vi.fn(),
    createNoShowAppeal: vi.fn(),
    listNoShowAppeals: vi.fn(),
    getNoShowAppeal: vi.fn(),
    listIncidents: vi.fn(),
    searchPlaces: vi.fn(),
    deleteCurrentSession: vi.fn(),
    putPushDevice: vi.fn(),
    deletePushDevice: vi.fn(),
    ...overrides,
  };
}

function SignedInBlocks() {
  const { createSession } = useAuthSession();

  useEffect(() => {
    void createSession({ requestId: userA.id, otp: "123456" });
  }, [createSession]);

  return <BlocksPage />;
}

let latestSession: AuthSessionContextValue;

function SwitchableBlocks() {
  latestSession = useAuthSession();
  return <BlocksPage />;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function problem(detail: string) {
  return new ApiProblemError(409, {
    type: "https://bungae.example/problems/blocked",
    title: "Blocked request failed",
    status: 409,
    detail,
    instance: "/v1/me/blocks",
    code: "BLOCK_FAILED",
    traceId: "trace-1",
  });
}

beforeEach(() => {
  latestSession = undefined as never;
  setOnline(true);
});

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}

describe("BlocksPage", () => {
  it("does not expose fixture identities while unauthenticated", () => {
    render(<BlocksPage />);

    expect(screen.getByText("로그인한 뒤 차단 목록을 확인해 주세요.")).toBeInTheDocument();
    expect(screen.queryByText("지민")).not.toBeInTheDocument();
  });

  it("loads only authenticated Block DTO fields", async () => {
    const api = createApi({ listBlocks: vi.fn().mockResolvedValue({ items: [blockA] }) });
    render(<AuthSessionProvider api={api}><SignedInBlocks /></AuthSessionProvider>);

    expect(await screen.findByText(blockA.blockedUserId)).toBeInTheDocument();
    expect(screen.queryByText(userA.displayName)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: blockA.blockedUserId })).not.toBeInTheDocument();
    expect(api.listBlocks).toHaveBeenCalledWith({ cursor: undefined, limit: 20 }, "access-a");
  });

  it("shows initial loading errors and retries the authenticated request", async () => {
    const api = createApi({
      listBlocks: vi.fn()
        .mockRejectedValueOnce(problem("서버가 목록을 거절했어요."))
        .mockResolvedValueOnce({ items: [blockA] }),
    });
    render(<AuthSessionProvider api={api}><SignedInBlocks /></AuthSessionProvider>);

    expect(await screen.findByText("서버가 목록을 거절했어요.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText(blockA.blockedUserId)).toBeInTheDocument();
    expect(api.listBlocks).toHaveBeenCalledTimes(2);
  });

  it("keeps the first page on cursor failure then retries and deduplicates appended blocks", async () => {
    const api = createApi({
      listBlocks: vi.fn()
        .mockResolvedValueOnce({ items: [blockA], nextCursor: "cursor-a" })
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce({ items: [blockA, blockB] }),
    });
    render(<AuthSessionProvider api={api}><SignedInBlocks /></AuthSessionProvider>);

    expect(await screen.findByText(blockA.blockedUserId)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("차단 목록을 불러오지 못했어요.");
    expect(screen.getByText(blockA.blockedUserId)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText(blockB.blockedUserId)).toBeInTheDocument();
    expect(screen.getAllByText(blockA.blockedUserId)).toHaveLength(1);
    expect(api.listBlocks).toHaveBeenNthCalledWith(2, { cursor: "cursor-a", limit: 20 }, "access-a");
    expect(api.listBlocks).toHaveBeenNthCalledWith(3, { cursor: "cursor-a", limit: 20 }, "access-a");
  });

  it("drops a late old-account list after an account change", async () => {
    const oldList = deferred<BlockPage>();
    const api = createApi({
      createSession: vi.fn(({ requestId }) => Promise.resolve({
        accessToken: requestId === userB.id ? "access-b" : "access-a",
        refreshToken: "refresh",
        expiresIn: 900,
        user: requestId === userB.id ? userB : userA,
      })),
      listBlocks: vi.fn()
        .mockReturnValueOnce(oldList.promise)
        .mockResolvedValueOnce({ items: [blockB] }),
    });
    render(<AuthSessionProvider api={api}><SwitchableBlocks /></AuthSessionProvider>);

    await act(async () => {
      await latestSession.createSession({ requestId: userA.id, otp: "123456" });
      await latestSession.createSession({ requestId: userB.id, otp: "654321" });
    });
    expect(await screen.findByText(blockB.blockedUserId)).toBeInTheDocument();

    await act(async () => {
      oldList.resolve({ items: [blockA] });
    });
    expect(screen.queryByText(blockA.blockedUserId)).not.toBeInTheDocument();
  });

  it("restores the unblock trigger after Escape and cancel", async () => {
    const api = createApi({ listBlocks: vi.fn().mockResolvedValue({ items: [blockA] }) });
    render(<AuthSessionProvider api={api}><SignedInBlocks /></AuthSessionProvider>);

    const trigger = await screen.findByRole("button", { name: "차단 해제" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "차단을 해제할까요?" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("keeps the item through the DELETE response, blocks duplicates, then focuses the count", async () => {
    const deletion = deferred<void>();
    const api = createApi({
      listBlocks: vi.fn().mockResolvedValue({ items: [blockA] }),
      deleteBlock: vi.fn().mockReturnValue(deletion.promise),
    });
    render(<AuthSessionProvider api={api}><SignedInBlocks /></AuthSessionProvider>);

    fireEvent.click(await screen.findByRole("button", { name: "차단 해제" }));
    const confirm = within(screen.getByRole("dialog", { name: "차단을 해제할까요?" })).getByRole("button", { name: "차단 해제" });
    fireEvent.click(confirm);
    await waitFor(() => expect(api.deleteBlock).toHaveBeenCalledTimes(1));
    fireEvent.click(confirm);
    expect(screen.getByText(blockA.blockedUserId)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "차단 해제 중…" })).toBeDisabled();

    await act(async () => {
      deletion.resolve();
    });
    await waitFor(() => {
      expect(screen.queryByText(blockA.blockedUserId)).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "차단한 사람 0명" })).toHaveFocus();
    });
  });

  it("shows a generic DELETE failure and retries without hiding the item", async () => {
    const api = createApi({
      listBlocks: vi.fn().mockResolvedValue({ items: [blockA] }),
      deleteBlock: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined),
    });
    render(<AuthSessionProvider api={api}><SignedInBlocks /></AuthSessionProvider>);

    fireEvent.click(await screen.findByRole("button", { name: "차단 해제" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "차단을 해제할까요?" })).getByRole("button", { name: "차단 해제" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("차단을 해제하지 못했어요.");
    expect(screen.getByText(blockA.blockedUserId)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "차단 해제" }));
    await waitFor(() => expect(screen.queryByText(blockA.blockedUserId)).not.toBeInTheDocument());
  });

  it("shows an API DELETE failure without replacing its server detail", async () => {
    const api = createApi({
      listBlocks: vi.fn().mockResolvedValue({ items: [blockA] }),
      deleteBlock: vi.fn().mockRejectedValue(problem("이미 해제된 차단이에요.")),
    });
    render(<AuthSessionProvider api={api}><SignedInBlocks /></AuthSessionProvider>);

    fireEvent.click(await screen.findByRole("button", { name: "차단 해제" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "차단을 해제할까요?" })).getByRole("button", { name: "차단 해제" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("이미 해제된 차단이에요.");
    expect(screen.getByText(blockA.blockedUserId)).toBeInTheDocument();
  });

  it("ignores late old-account DELETE success and error completions", async () => {
    const oldSuccess = deferred<void>();
    const oldFailure = deferred<void>();
    const api = createApi({
      createSession: vi.fn(({ requestId }) => Promise.resolve({
        accessToken: requestId === userB.id ? "access-b" : "access-a",
        refreshToken: "refresh",
        expiresIn: 900,
        user: requestId === userB.id ? userB : userA,
      })),
      listBlocks: vi.fn().mockResolvedValue({ items: [blockA] }),
      deleteBlock: vi.fn().mockReturnValueOnce(oldSuccess.promise).mockReturnValueOnce(oldFailure.promise),
    });
    render(<AuthSessionProvider api={api}><SwitchableBlocks /></AuthSessionProvider>);

    await act(async () => {
      await latestSession.createSession({ requestId: userA.id, otp: "123456" });
    });
    fireEvent.click(await screen.findByRole("button", { name: "차단 해제" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "차단을 해제할까요?" })).getByRole("button", { name: "차단 해제" }));
    await act(async () => {
      await latestSession.createSession({ requestId: userB.id, otp: "654321" });
    });
    await act(async () => {
      oldSuccess.resolve();
    });
    expect(screen.getByText(blockA.blockedUserId)).toBeInTheDocument();
    expect(screen.queryByText("이전 계정 오류")).not.toBeInTheDocument();

    await act(async () => {
      await latestSession.createSession({ requestId: userA.id, otp: "123456" });
    });
    fireEvent.click(await screen.findByRole("button", { name: "차단 해제" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "차단을 해제할까요?" })).getByRole("button", { name: "차단 해제" }));
    await act(async () => {
      await latestSession.createSession({ requestId: userB.id, otp: "654321" });
    });
    await act(async () => {
      oldFailure.reject(problem("이전 계정 오류"));
    });
    expect(screen.queryByText("이전 계정 오류")).not.toBeInTheDocument();
  });

  it("drops a stale reload after the same subject logs out and back in", async () => {
    const firstLoad = deferred<BlockPage>();
    const api = createApi({
      listBlocks: vi.fn().mockReturnValueOnce(firstLoad.promise).mockResolvedValue({ items: [blockB] }),
    });
    render(<AuthSessionProvider api={api}><SwitchableBlocks /></AuthSessionProvider>);

    await act(async () => {
      await latestSession.createSession({ requestId: userA.id, otp: "123456" });
    });
    await waitFor(() => expect(api.listBlocks).toHaveBeenCalledTimes(1));

    await act(async () => {
      await latestSession.logout();
    });
    expect(screen.getByText("로그인한 뒤 차단 목록을 확인해 주세요.")).toBeInTheDocument();

    await act(async () => {
      await latestSession.createSession({ requestId: userA.id, otp: "654321" });
    });
    expect(await screen.findByText(blockB.blockedUserId)).toBeInTheDocument();
    expect(api.listBlocks).toHaveBeenCalledTimes(2);

    await act(async () => firstLoad.resolve({ items: [blockA] }));
    expect(screen.queryByText(blockA.blockedUserId)).not.toBeInTheDocument();
  });

  it("keeps unblock disabled offline and explains why in the dialog", async () => {
    const api = createApi({ listBlocks: vi.fn().mockResolvedValue({ items: [blockA] }) });
    render(<AuthSessionProvider api={api}><SignedInBlocks /></AuthSessionProvider>);

    fireEvent.click(await screen.findByRole("button", { name: "차단 해제" }));
    const dialog = screen.getByRole("dialog", { name: "차단을 해제할까요?" });
    const confirm = within(dialog).getByRole("button", { name: "차단 해제" });
    expect(confirm).toBeEnabled();

    act(() => setOnline(false));
    expect(screen.getByText("인터넷 연결이 끊겼어요")).toBeInTheDocument();
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(api.deleteBlock).not.toHaveBeenCalled();

    act(() => setOnline(true));
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);
    await waitFor(() => expect(api.deleteBlock).toHaveBeenCalledWith("blocked-a", "access-a"));
  });
});
