import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiProblemError, type BungaeApi } from "@/lib/api/client";
import type { Message, UserProfile } from "@/lib/api/types";
import { AuthSessionProvider, useAuthSession } from "@/lib/auth/auth-session-provider";

let routeMeetupId = "meetup-a";
vi.mock("next/navigation", () => ({ useParams: () => ({ meetupId: routeMeetupId }) }));

import MeetupChatPage from "./page";

const userA: UserProfile = { id: "user-a", displayName: "민지", ageBand: "25_34", interestCodes: [], homeAreaCode: "MAPO", adultVerified: true, identityVerified: true, version: 1, createdAt: "2026-09-07T00:00:00Z", updatedAt: "2026-09-07T00:00:00Z" };
const userB: UserProfile = { ...userA, id: "user-b", displayName: "준호" };
const aMessage: Message = { id: "message-a", sender: { userId: userA.id, displayName: "민지" }, text: "A 메시지", createdAt: "2026-09-07T10:00:00Z" };
const otherMessage: Message = { id: "message-other", sender: { userId: "other", displayName: "지민" }, text: "다른 참가자 메시지", createdAt: "2026-09-07T10:01:00Z" };
const bMessage: Message = { id: "message-b", sender: { userId: userB.id, displayName: "준호" }, text: "B 메시지", createdAt: "2026-09-07T11:00:00Z" };

function createApi(overrides: Partial<BungaeApi> = {}): BungaeApi {
  return {
    requestOtp: vi.fn(), createSession: vi.fn().mockImplementation(({ requestId }) => Promise.resolve({ accessToken: `access-${requestId}`, refreshToken: `refresh-${requestId}`, expiresIn: 900, user: requestId === userB.id ? userB : userA })), refreshSession: vi.fn(), getMe: vi.fn(), updateMe: vi.fn(), getActivityPolicies: vi.fn(), createVerificationSession: vi.fn(), listMeetups: vi.fn(), listMyMeetups: vi.fn(), getMeetup: vi.fn(), createMeetup: vi.fn(), joinMeetup: vi.fn(), leaveMeetup: vi.fn(), cancelMeetup: vi.fn(), decideQuorum: vi.fn(), checkInMeetup: vi.fn(), listNotifications: vi.fn(), markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn(), listMeetupMessages: vi.fn().mockResolvedValue({ items: [aMessage, otherMessage] }), createMeetupMessage: vi.fn().mockResolvedValue({ ...aMessage, id: "message-new", text: "새 메시지" }), searchPlaces: vi.fn(), deleteCurrentSession: vi.fn(), putPushDevice: vi.fn(), deletePushDevice: vi.fn(), ...overrides,
    createReport: vi.fn(), createFeedback: vi.fn(), listParticipants: vi.fn(), createConnectionIntent: vi.fn(), listConnections: vi.fn(), deleteConnection: vi.fn(), listBlocks: vi.fn(), createBlock: vi.fn(), deleteBlock: vi.fn(),
    createImpressions: vi.fn(), createNextIntent: vi.fn(),
    getWithdrawal: vi.fn(),
    scheduleWithdrawal: vi.fn(),
    cancelWithdrawal: vi.fn(),
    createNoShowAppeal: vi.fn(),
    listNoShowAppeals: vi.fn(),
    getNoShowAppeal: vi.fn(),
    listIncidents: vi.fn(),
  };
}

function SessionPage() {
  const { createSession } = useAuthSession();
  useEffect(() => { void createSession({ requestId: userA.id, otp: "123456" }); }, [createSession]);
  return <><button type="button" onClick={() => void createSession({ requestId: userB.id, otp: "654321" })}>B 계정으로 전환</button><MeetupChatPage /></>;
}

function renderAuthenticated(api: BungaeApi) {
  return render(<AuthSessionProvider api={api}><SessionPage /></AuthSessionProvider>);
}

function typeDraft(text: string) {

  fireEvent.change(screen.getByRole("textbox", { name: "메시지 입력" }), { target: { value: text } });
}

describe("MeetupChatPage API behavior", () => {
  beforeEach(() => {
    routeMeetupId = "meetup-a";
  });

  it("renders authenticated empty state", async () => {
    renderAuthenticated(createApi({ listMeetupMessages: vi.fn().mockResolvedValue({ items: [] }) }));
    expect(await screen.findByText("표시할 메시지가 없어요.")).toBeInTheDocument();
  });

  it("renders only sender display name, text, and created time; sender userId determines mine", async () => {
    renderAuthenticated(createApi());
    expect(await screen.findByText("A 메시지")).toBeInTheDocument();
    expect(screen.getByText("민지")).toBeInTheDocument();
    expect(screen.getByText("지민")).toBeInTheDocument();
    expect(screen.getByText("A 메시지").parentElement).toHaveClass("items-end");
    expect(screen.getByText("다른 참가자 메시지").parentElement).toHaveClass("items-start");
    expect(screen.queryByText(/참여|오늘|합정 보드게임/)).not.toBeInTheDocument();
  });

  it("retries initial list failures and preserves cursor items after append failure", async () => {
    const listMeetupMessages = vi.fn().mockRejectedValueOnce(new ApiProblemError(403, { type: "problem", title: "권한 없음", status: 403, detail: "참가자만 메시지를 볼 수 있어요.", instance: "", code: "FORBIDDEN", traceId: "trace" })).mockResolvedValueOnce({ items: [aMessage], nextCursor: "next/value" }).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ items: [otherMessage] });
    renderAuthenticated(createApi({ listMeetupMessages }));
    expect(await screen.findByText("참가자만 메시지를 볼 수 있어요.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("A 메시지")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "메시지 더 보기" }));
    await waitFor(() => expect(listMeetupMessages).toHaveBeenCalledTimes(3));
    expect(screen.getByText("A 메시지")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "메시지 더 보기" }));
    expect(await screen.findByText("다른 참가자 메시지")).toBeInTheDocument();
    expect(listMeetupMessages).toHaveBeenLastCalledWith("meetup-a", { cursor: "next/value", limit: 20 }, `access-${userA.id}`);
  });

  it("displays a safe 404 problem detail", async () => {
    const listMeetupMessages = vi.fn().mockRejectedValue(new ApiProblemError(404, { type: "problem", title: "찾을 수 없음", status: 404, detail: "이 모임의 메시지를 찾을 수 없어요.", instance: "", code: "NOT_FOUND", traceId: "trace" }));
    renderAuthenticated(createApi({ listMeetupMessages }));
    expect(await screen.findByText("이 모임의 메시지를 찾을 수 없어요.")).toBeInTheDocument();
  });

  it("commits B route data before ignoring A's late route list", async () => {
    const aList = Promise.withResolvers<{ items: Message[] }>();
    const bList = Promise.withResolvers<{ items: Message[] }>();
    const listMeetupMessages = vi.fn().mockImplementation((meetupId) => meetupId === "meetup-a" ? aList.promise : bList.promise);
    const view = renderAuthenticated(createApi({ listMeetupMessages }));
    await waitFor(() => expect(listMeetupMessages).toHaveBeenCalledWith("meetup-a", { cursor: undefined, limit: 20 }, `access-${userA.id}`));
    expect(screen.getByRole("status")).toHaveTextContent("메시지를 불러오고 있어요.");
    routeMeetupId = "meetup-b";
    view.rerender(<AuthSessionProvider api={createApi({ listMeetupMessages })}><SessionPage /></AuthSessionProvider>);
    await waitFor(() => expect(listMeetupMessages).toHaveBeenCalledWith("meetup-b", { cursor: undefined, limit: 20 }, `access-${userA.id}`));
    await act(async () => { bList.resolve({ items: [bMessage] }); });
    expect(await screen.findByText("B 메시지")).toBeInTheDocument();
    await act(async () => { aList.resolve({ items: [aMessage] }); });
    expect(screen.queryByText("A 메시지")).not.toBeInTheDocument();
  });

  it("commits B account data before ignoring A's late list", async () => {
    const aList = Promise.withResolvers<{ items: Message[] }>();
    const bList = Promise.withResolvers<{ items: Message[] }>();
    const listMeetupMessages = vi.fn().mockImplementation((_meetupId, _input, accessToken) => accessToken === `access-${userA.id}` ? aList.promise : bList.promise);
    renderAuthenticated(createApi({ listMeetupMessages }));
    await waitFor(() => expect(listMeetupMessages).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "B 계정으로 전환" }));
    await waitFor(() => expect(listMeetupMessages).toHaveBeenCalledWith("meetup-a", { cursor: undefined, limit: 20 }, `access-${userB.id}`));
    await act(async () => { bList.resolve({ items: [bMessage] }); });
    expect(await screen.findByText("B 메시지")).toBeInTheDocument();
    await act(async () => { aList.resolve({ items: [aMessage] }); });
    expect(screen.queryByText("A 메시지")).not.toBeInTheDocument();
  });

  it("validates trimmed 1..2000 character drafts", async () => {
    renderAuthenticated(createApi());
    await screen.findByText("A 메시지");
    const send = screen.getByRole("button", { name: "메시지 보내기" });
    typeDraft("   ");
    expect(send).toBeDisabled();
    typeDraft("x".repeat(2001));
    expect(send).toBeDisabled();
    typeDraft("  유효한 메시지  ");
    expect(send).toBeEnabled();
  });

  it("appends only the 201 message once and clears the draft after success", async () => {
    const created = { ...aMessage, id: "message-created", text: "보낸 메시지" };
    const createMeetupMessage = vi.fn().mockResolvedValue(created);
    renderAuthenticated(createApi({ createMeetupMessage }));
    await screen.findByText("A 메시지");
    typeDraft("  보낸 메시지  ");
    fireEvent.submit(screen.getByRole("button", { name: "메시지 보내기" }).closest("form")!);
    expect(await screen.findByText("보낸 메시지")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "메시지 입력" })).toHaveValue("");
    expect(createMeetupMessage).toHaveBeenCalledWith("meetup-a", "보낸 메시지", expect.any(String), `access-${userA.id}`);
    expect(screen.getAllByText("보낸 메시지")).toHaveLength(1);
  });

  it("blocks duplicate in-flight sends", async () => {
    const pending = Promise.withResolvers<Message>();
    const createMeetupMessage = vi.fn().mockReturnValue(pending.promise);
    renderAuthenticated(createApi({ createMeetupMessage }));
    await screen.findByText("A 메시지");
    typeDraft("한 번만");
    const form = screen.getByRole("button", { name: "메시지 보내기" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(createMeetupMessage).toHaveBeenCalledTimes(1));
    await act(async () => { pending.resolve({ ...aMessage, id: "once", text: "한 번만" }); });
    expect(await screen.findByText("한 번만")).toBeInTheDocument();
  });

  it("reuses the failed text key, creates a new key for changed text, and permits retry", async () => {
    const createMeetupMessage = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ...aMessage, id: "retry", text: "재시도" }).mockResolvedValueOnce({ ...aMessage, id: "changed", text: "변경" });
    renderAuthenticated(createApi({ createMeetupMessage }));
    await screen.findByText("A 메시지");
    typeDraft("재시도");
    fireEvent.submit(screen.getByRole("button", { name: "메시지 보내기" }).closest("form")!);
    expect(await screen.findByText("메시지를 보내지 못했어요.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "메시지 입력" })).toHaveValue("재시도");
    fireEvent.submit(screen.getByRole("button", { name: "메시지 보내기" }).closest("form")!);
    expect(await screen.findByText("재시도")).toBeInTheDocument();
    const retryKey = createMeetupMessage.mock.calls[0][2];
    expect(createMeetupMessage.mock.calls[1][2]).toBe(retryKey);
    typeDraft("변경");
    fireEvent.submit(screen.getByRole("button", { name: "메시지 보내기" }).closest("form")!);
    expect(await screen.findByText("변경")).toBeInTheDocument();
    expect(createMeetupMessage.mock.calls[2][2]).not.toBe(retryKey);
  });

  it("ignores a late old-route send completion without overwriting the new route draft", async () => {
    const pending = Promise.withResolvers<Message>();
    const createMeetupMessage = vi.fn().mockReturnValue(pending.promise);
    const view = renderAuthenticated(createApi({ createMeetupMessage }));
    await screen.findByText("A 메시지");
    typeDraft("A 초안");
    fireEvent.submit(screen.getByRole("button", { name: "메시지 보내기" }).closest("form")!);
    routeMeetupId = "meetup-b";
    view.rerender(<AuthSessionProvider api={createApi({ createMeetupMessage })}><SessionPage /></AuthSessionProvider>);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "메시지 입력" })).toHaveValue(""));
    typeDraft("B 초안");
    await act(async () => { pending.resolve({ ...aMessage, id: "late", text: "늦은 A" }); });
    expect(screen.getByRole("textbox", { name: "메시지 입력" })).toHaveValue("B 초안");
    expect(screen.queryByText("늦은 A")).not.toBeInTheDocument();
  });
  it("ignores a late old-account send error without overwriting B draft, messages, or pending state", async () => {
    const pending = Promise.withResolvers<Message>();
    const listMeetupMessages = vi.fn().mockImplementation((_meetupId, _input, accessToken) => Promise.resolve({ items: accessToken === `access-${userA.id}` ? [aMessage] : [bMessage] }));
    const createMeetupMessage = vi.fn().mockReturnValue(pending.promise);
    renderAuthenticated(createApi({ listMeetupMessages, createMeetupMessage }));
    await screen.findByText("A 메시지");
    typeDraft("A 초안");
    fireEvent.submit(screen.getByRole("button", { name: "메시지 보내기" }).closest("form")!);
    fireEvent.click(screen.getByRole("button", { name: "B 계정으로 전환" }));
    expect(await screen.findByText("B 메시지")).toBeInTheDocument();
    typeDraft("B 초안");
    expect(screen.getByRole("button", { name: "메시지 보내기" })).toBeEnabled();
    await act(async () => { pending.reject(new Error("offline")); });
    expect(screen.getByRole("textbox", { name: "메시지 입력" })).toHaveValue("B 초안");
    expect(screen.queryByText("메시지를 보내지 못했어요.")).not.toBeInTheDocument();
    expect(screen.getByText("B 메시지")).toBeInTheDocument();
  });

});
