import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthSessionProvider } from "@/lib/auth/auth-session-provider";
import NoShowAppealDetailPage from "./page";
import {
  anotherUser,
  AuthenticatedTestRoot,
  createApi,
  deferred,
  getLatestSession,
  renderAuthenticated,
  user,
} from "../../../meetups/[meetupId]/action-page-test-utils";

let routeAppealId = "appeal-1";
vi.mock("next/navigation", () => ({ useParams: () => ({ appealId: routeAppealId }) }));

const appeal = { id: "appeal-1", attendanceId: "attendance-1", meetupId: "meetup-1", userId: "user-1", reason: "기록이 정확하지 않아요.", state: "ACCEPTED" as const, submittedAt: "2026-09-08T00:00:00Z", deadlineAt: "2026-09-15T00:00:00Z", reviewedBy: "admin-1", resolution: "정정됐어요.", reviewedAt: "2026-09-09T00:00:00Z", createdAt: "2026-09-08T00:00:00Z", updatedAt: "2026-09-09T00:00:00Z", version: 2, evidenceIds: [] };

beforeEach(() => {
  routeAppealId = "appeal-1";
});

describe("NoShowAppealDetailPage", () => {
  it("blocks unauthenticated detail access", () => { render(<AuthSessionProvider><NoShowAppealDetailPage /></AuthSessionProvider>); expect(screen.getByText("로그인 후 이의 상세를 확인할 수 있어요.")).toBeInTheDocument(); });
  it("renders only server detail fields and conditional resolution", async () => { const api = createApi({ getNoShowAppeal: vi.fn().mockResolvedValue(appeal) }); renderAuthenticated(<NoShowAppealDetailPage />, api); await screen.findByText("ACCEPTED"); expect(screen.getByText(appeal.reason)).toBeInTheDocument(); expect(screen.getByText(appeal.resolution)).toBeInTheDocument(); expect(screen.getByText(appeal.reviewedAt)).toBeInTheDocument(); expect(screen.queryByText(appeal.userId)).not.toBeInTheDocument(); });
  it("keeps generic detail errors retryable", async () => { const api = createApi({ getNoShowAppeal: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ...appeal, resolution: null, reviewedAt: null }) }); renderAuthenticated(<NoShowAppealDetailPage />, api); expect(await screen.findByRole("alert")).toHaveTextContent("이의 상세를 불러오지 못했어요"); fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" })); await screen.findByText("ACCEPTED"); expect(screen.queryByText("처리 결과")).not.toBeInTheDocument(); });

  it("renders the exposed initial loading state before detail resolves", async () => {
    const request = deferred<typeof appeal>();
    const api = createApi({ getNoShowAppeal: vi.fn().mockReturnValue(request.promise) });
    renderAuthenticated(<NoShowAppealDetailPage />, api);

    expect(await screen.findByRole("status")).toHaveTextContent("이의 상세를 불러오는 중이에요.");
    await act(async () => request.resolve(appeal));
    expect(await screen.findByText("ACCEPTED")).toBeInTheDocument();
  });

  it("suppresses a late old-route detail success", async () => {
    const first = deferred<typeof appeal>();
    const replacement = { ...appeal, id: "appeal-2", state: "REVIEWING" as const };
    const api = createApi({ getNoShowAppeal: vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(replacement) });
    const view = renderAuthenticated(<NoShowAppealDetailPage />, api);

    await waitFor(() => expect(api.getNoShowAppeal).toHaveBeenCalledTimes(1));
    routeAppealId = "appeal-2";
    view.rerender(<AuthenticatedTestRoot api={api}><NoShowAppealDetailPage /></AuthenticatedTestRoot>);
    await screen.findByText("REVIEWING");
    await act(async () => first.resolve(appeal));

    expect(screen.queryByText("ACCEPTED")).not.toBeInTheDocument();
  });

  it("suppresses a late old-route detail error", async () => {
    const first = deferred<typeof appeal>();
    const replacement = { ...appeal, id: "appeal-2", state: "REVIEWING" as const };
    const api = createApi({ getNoShowAppeal: vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(replacement) });
    const view = renderAuthenticated(<NoShowAppealDetailPage />, api);

    await waitFor(() => expect(api.getNoShowAppeal).toHaveBeenCalledTimes(1));
    routeAppealId = "appeal-2";
    view.rerender(<AuthenticatedTestRoot api={api}><NoShowAppealDetailPage /></AuthenticatedTestRoot>);
    await screen.findByText("REVIEWING");
    await act(async () => first.reject(new Error("old route failure")));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("suppresses a late old-account detail success", async () => {
    const first = deferred<typeof appeal>();
    const replacement = { ...appeal, id: "appeal-1", state: "REVIEWING" as const };
    const api = createApi({
      createSession: vi.fn(({ requestId }) => Promise.resolve({
        accessToken: requestId === anotherUser.id ? "access-b" : "access",
        refreshToken: "refresh",
        expiresIn: 900,
        user: requestId === anotherUser.id ? anotherUser : user,
      })),
      getNoShowAppeal: vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(replacement),
    });
    renderAuthenticated(<NoShowAppealDetailPage />, api);

    await waitFor(() => expect(api.getNoShowAppeal).toHaveBeenCalledTimes(1));
    await act(async () => { await getLatestSession().createSession({ requestId: anotherUser.id, otp: "654321" }); });
    await screen.findByText("REVIEWING");
    await act(async () => first.resolve(appeal));

    expect(screen.queryByText("ACCEPTED")).not.toBeInTheDocument();
  });

  it("suppresses a late old-account detail error", async () => {
    const first = deferred<typeof appeal>();
    const replacement = { ...appeal, id: "appeal-1", state: "REVIEWING" as const };
    const api = createApi({
      createSession: vi.fn(({ requestId }) => Promise.resolve({
        accessToken: requestId === anotherUser.id ? "access-b" : "access",
        refreshToken: "refresh",
        expiresIn: 900,
        user: requestId === anotherUser.id ? anotherUser : user,
      })),
      getNoShowAppeal: vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(replacement),
    });
    renderAuthenticated(<NoShowAppealDetailPage />, api);

    await waitFor(() => expect(api.getNoShowAppeal).toHaveBeenCalledTimes(1));
    await act(async () => { await getLatestSession().createSession({ requestId: anotherUser.id, otp: "654321" }); });
    await screen.findByText("REVIEWING");
    await act(async () => first.reject(new Error("old account failure")));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("drops a stale detail after the same subject logs out and back in", async () => {
    const first = deferred<typeof appeal>();
    const api = createApi({
      getNoShowAppeal: vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(appeal),
    });
    renderAuthenticated(<NoShowAppealDetailPage />, api);
    await waitFor(() => expect(api.getNoShowAppeal).toHaveBeenCalledTimes(1));

    await act(async () => { await getLatestSession().logout(); });
    expect(screen.getByText("로그인 후 이의 상세를 확인할 수 있어요.")).toBeInTheDocument();

    await act(async () => { await getLatestSession().createSession({ requestId: user.id, otp: "654321" }); });
    await screen.findByText("ACCEPTED");
    expect(api.getNoShowAppeal).toHaveBeenCalledTimes(2);

    await act(async () => first.resolve(appeal));
    expect(screen.getByText("ACCEPTED")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
