import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthSessionProvider } from "@/lib/auth/auth-session-provider";
import NoShowAppealsPage from "./page";
import { anotherUser, createApi, deferred, getLatestSession, renderAuthenticated, user } from "../../meetups/[meetupId]/action-page-test-utils";

const appeal = { id: "appeal/with space", attendanceId: "attendance-1", meetupId: "meetup-1", userId: "a7c77e71-5b90-42f2-b9e1-8f6c8b1db76c", reason: "기록이 정확하지 않아요.", state: "REVIEWING" as const, submittedAt: "2026-09-08T00:00:00Z", deadlineAt: "2026-09-15T00:00:00Z", reviewedBy: null, resolution: null, reviewedAt: null, createdAt: "2026-09-08T00:00:00Z", updatedAt: "2026-09-08T00:00:00Z", version: 1, evidenceIds: [] };

describe("NoShowAppealsPage", () => {
  it("blocks unauthenticated list access", () => { render(<AuthSessionProvider><NoShowAppealsPage /></AuthSessionProvider>); expect(screen.getByText("로그인 후 내 이의를 확인할 수 있어요.")).toBeInTheDocument(); });
  it("renders server DTO values and an encoded detail link", async () => { const api = createApi({ listNoShowAppeals: vi.fn().mockResolvedValue([appeal]) }); renderAuthenticated(<NoShowAppealsPage />, api); await screen.findByText("REVIEWING"); expect(screen.getByRole("link", { name: /REVIEWING/ })).toHaveAttribute("href", "/profile/no-show-appeals/appeal%2Fwith%20space"); expect(screen.queryByText(appeal.userId)).not.toBeInTheDocument(); });
  it("renders the empty server list", async () => { const api = createApi({ listNoShowAppeals: vi.fn().mockResolvedValue([]) }); renderAuthenticated(<NoShowAppealsPage />, api); expect(await screen.findByText("제출한 노쇼 이의가 없어요.")).toBeInTheDocument(); });
  it("keeps a GET failure retryable", async () => { const api = createApi({ listNoShowAppeals: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]) }); renderAuthenticated(<NoShowAppealsPage />, api); expect(await screen.findByRole("alert")).toHaveTextContent("이의 목록을 불러오지 못했어요"); fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" })); await screen.findByText("제출한 노쇼 이의가 없어요."); });
  it("ignores a late account A list result after session B commits", async () => {
    const first = deferred<typeof appeal[]>();
    const api = createApi({
      createSession: vi.fn(({ requestId }) => Promise.resolve({
        accessToken: requestId === anotherUser.id ? "access-b" : "access",
        refreshToken: "refresh",
        expiresIn: 900,
        user: requestId === anotherUser.id ? anotherUser : user,
      })),
      listNoShowAppeals: vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce([]),
    });
    renderAuthenticated(<NoShowAppealsPage />, api);
    await waitFor(() => expect(api.listNoShowAppeals).toHaveBeenCalledTimes(1));
    await act(async () => { await getLatestSession().createSession({ requestId: anotherUser.id, otp: "123456" }); });
    await screen.findByText("제출한 노쇼 이의가 없어요.");
    await act(async () => first.resolve([appeal]));
    expect(screen.queryByText("REVIEWING")).not.toBeInTheDocument();
  });

  it("renders the exposed initial loading state before the list resolves", async () => {
    const request = deferred<typeof appeal[]>();
    const api = createApi({ listNoShowAppeals: vi.fn().mockReturnValue(request.promise) });
    renderAuthenticated(<NoShowAppealsPage />, api);

    expect(await screen.findByRole("status")).toHaveTextContent("이의 목록을 불러오는 중이에요.");
    await act(async () => request.resolve([]));
    expect(await screen.findByText("제출한 노쇼 이의가 없어요.")).toBeInTheDocument();
  });

  it("ignores a late account A list error after session B commits", async () => {
    const first = deferred<typeof appeal[]>();
    const api = createApi({
      createSession: vi.fn(({ requestId }) => Promise.resolve({
        accessToken: requestId === anotherUser.id ? "access-b" : "access",
        refreshToken: "refresh",
        expiresIn: 900,
        user: requestId === anotherUser.id ? anotherUser : user,
      })),
      listNoShowAppeals: vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce([]),
    });
    renderAuthenticated(<NoShowAppealsPage />, api);
    await waitFor(() => expect(api.listNoShowAppeals).toHaveBeenCalledTimes(1));
    await act(async () => { await getLatestSession().createSession({ requestId: anotherUser.id, otp: "123456" }); });
    await screen.findByText("제출한 노쇼 이의가 없어요.");
    await act(async () => first.reject(new Error("old account failure")));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("drops a stale reload after the same subject logs out and back in", async () => {
    const first = deferred<typeof appeal[]>();
    const api = createApi({
      listNoShowAppeals: vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce([]),
    });
    renderAuthenticated(<NoShowAppealsPage />, api);
    await waitFor(() => expect(api.listNoShowAppeals).toHaveBeenCalledTimes(1));

    await act(async () => { await getLatestSession().logout(); });
    expect(screen.getByText("로그인 후 내 이의를 확인할 수 있어요.")).toBeInTheDocument();

    await act(async () => { await getLatestSession().createSession({ requestId: user.id, otp: "654321" }); });
    await screen.findByText("제출한 노쇼 이의가 없어요.");
    expect(api.listNoShowAppeals).toHaveBeenCalledTimes(2);

    await act(async () => first.resolve([appeal]));
    expect(screen.queryByText("REVIEWING")).not.toBeInTheDocument();
    expect(screen.getByText("제출한 노쇼 이의가 없어요.")).toBeInTheDocument();
  });
});
