import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import IncidentsPage from "./page";
import {
  anotherUser,
  createApi,
  deferred,
  getLatestSession,
  renderAuthenticated,
  user,
} from "../../meetups/[meetupId]/action-page-test-utils";

const first = { incidentId: "incident-1", meetupId: "meetup-1", category: "SAFETY", urgency: "P1" as const, state: "RECEIVED", priority: "P1" as const, submittedAt: "2026-09-08T00:00:00Z" };
const second = { ...first, incidentId: "incident-2", state: "REVIEWING", submittedAt: "2026-09-09T00:00:00Z" };

describe("IncidentsPage", () => {
  it("loads server incident status and appends a deduplicated cursor page", async () => {
    const api = createApi({ listIncidents: vi.fn().mockResolvedValueOnce({ items: [first], nextCursor: "next/value" }).mockResolvedValueOnce({ items: [first, second] }) });
    renderAuthenticated(<IncidentsPage />, api);

    await screen.findByText("RECEIVED");
    fireEvent.click(screen.getByRole("button", { name: "더 불러오기" }));
    await screen.findByText("REVIEWING");
    expect(screen.getAllByText("RECEIVED")).toHaveLength(1);
    expect(api.listIncidents).toHaveBeenNthCalledWith(1, { limit: 20 }, "access");
    expect(api.listIncidents).toHaveBeenNthCalledWith(2, { cursor: "next/value", limit: 20 }, "access");
  });

  it("keeps an initial query failure retryable", async () => {
    const api = createApi({ listIncidents: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ items: [] }) });
    renderAuthenticated(<IncidentsPage />, api);

    expect(await screen.findByRole("alert")).toHaveTextContent("신고 결과를 불러오지 못했어요");
    fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
    await screen.findByText("제출한 신고가 없어요.");
    await waitFor(() => expect(api.listIncidents).toHaveBeenCalledTimes(2));
  });

  it("blocks unauthenticated incident history access", () => {
    render(<IncidentsPage />);

    expect(screen.getByText("로그인 후 내가 제출한 신고 결과를 확인할 수 있어요.")).toBeInTheDocument();
  });

  it("renders the initial loading state before incident history resolves", async () => {
    const request = deferred<{ items: typeof first[]; nextCursor?: string }>();
    const api = createApi({ listIncidents: vi.fn().mockReturnValue(request.promise) });
    renderAuthenticated(<IncidentsPage />, api);

    expect(await screen.findByRole("status")).toHaveTextContent("신고 결과를 불러오는 중이에요.");
    await act(async () => request.resolve({ items: [] }));
    expect(await screen.findByText("제출한 신고가 없어요.")).toBeInTheDocument();
  });

  it("renders an empty initial incident history", async () => {
    const api = createApi({ listIncidents: vi.fn().mockResolvedValue({ items: [] }) });
    renderAuthenticated(<IncidentsPage />, api);

    expect(await screen.findByText("제출한 신고가 없어요.")).toBeInTheDocument();
  });

  it("keeps prior incidents visible when cursor append fails, then retries the same cursor", async () => {
    const api = createApi({
      listIncidents: vi.fn()
        .mockResolvedValueOnce({ items: [first], nextCursor: "next/value" })
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce({ items: [second] }),
    });
    renderAuthenticated(<IncidentsPage />, api);

    await screen.findByText("RECEIVED");
    fireEvent.click(screen.getByRole("button", { name: "더 불러오기" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("다음 신고 결과를 불러오지 못했어요");
    expect(screen.getByText("RECEIVED")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByText("REVIEWING")).toBeInTheDocument();
    expect(api.listIncidents).toHaveBeenNthCalledWith(2, { cursor: "next/value", limit: 20 }, "access");
    expect(api.listIncidents).toHaveBeenNthCalledWith(3, { cursor: "next/value", limit: 20 }, "access");
  });

  it("suppresses a late old-account incident success", async () => {
    const firstRequest = deferred<{ items: typeof first[]; nextCursor?: string }>();
    const api = createApi({
      createSession: vi.fn(({ requestId }) => Promise.resolve({
        accessToken: requestId === anotherUser.id ? "access-b" : "access",
        refreshToken: "refresh",
        expiresIn: 900,
        user: requestId === anotherUser.id ? anotherUser : user,
      })),
      listIncidents: vi.fn().mockReturnValueOnce(firstRequest.promise).mockResolvedValueOnce({ items: [] }),
    });
    renderAuthenticated(<IncidentsPage />, api);

    await waitFor(() => expect(api.listIncidents).toHaveBeenCalledTimes(1));
    await act(async () => { await getLatestSession().createSession({ requestId: anotherUser.id, otp: "654321" }); });
    await screen.findByText("제출한 신고가 없어요.");
    await act(async () => firstRequest.resolve({ items: [first] }));

    expect(screen.queryByText("RECEIVED")).not.toBeInTheDocument();
  });

  it("suppresses a late old-account incident error", async () => {
    const firstRequest = deferred<{ items: typeof first[]; nextCursor?: string }>();
    const api = createApi({
      createSession: vi.fn(({ requestId }) => Promise.resolve({
        accessToken: requestId === anotherUser.id ? "access-b" : "access",
        refreshToken: "refresh",
        expiresIn: 900,
        user: requestId === anotherUser.id ? anotherUser : user,
      })),
      listIncidents: vi.fn().mockReturnValueOnce(firstRequest.promise).mockResolvedValueOnce({ items: [] }),
    });
    renderAuthenticated(<IncidentsPage />, api);

    await waitFor(() => expect(api.listIncidents).toHaveBeenCalledTimes(1));
    await act(async () => { await getLatestSession().createSession({ requestId: anotherUser.id, otp: "654321" }); });
    await screen.findByText("제출한 신고가 없어요.");
    await act(async () => firstRequest.reject(new Error("old account failure")));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("drops a stale reload after the same subject logs out and back in", async () => {
    const firstRequest = deferred<{ items: typeof first[]; nextCursor?: string }>();
    const api = createApi({
      listIncidents: vi.fn().mockReturnValueOnce(firstRequest.promise).mockResolvedValueOnce({ items: [] }),
    });
    renderAuthenticated(<IncidentsPage />, api);
    await waitFor(() => expect(api.listIncidents).toHaveBeenCalledTimes(1));

    await act(async () => { await getLatestSession().logout(); });
    expect(screen.getByText("로그인 후 내가 제출한 신고 결과를 확인할 수 있어요.")).toBeInTheDocument();

    await act(async () => { await getLatestSession().createSession({ requestId: user.id, otp: "654321" }); });
    await screen.findByText("제출한 신고가 없어요.");
    expect(api.listIncidents).toHaveBeenCalledTimes(2);

    await act(async () => firstRequest.resolve({ items: [first] }));
    expect(screen.queryByText("RECEIVED")).not.toBeInTheDocument();
    expect(screen.getByText("제출한 신고가 없어요.")).toBeInTheDocument();
  });
});
