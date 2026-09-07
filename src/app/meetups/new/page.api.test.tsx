import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSessionContextValue } from "@/lib/auth/auth-session-provider";
import type { Meetup, ProviderPlace } from "@/lib/api/types";

import NewMeetupPage from "./page";

const routerPush = vi.hoisted(() => vi.fn());
const setNavigationIntent = vi.hoisted(() => vi.fn());
const useSearchParams = vi.hoisted(() => vi.fn());
const useOptionalAuthSession = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
  useSearchParams: () => useSearchParams(),
}));

vi.mock("@/components/navigation-intent", () => ({
  setNavigationIntent,
}));

vi.mock("@/lib/auth/auth-session-provider", () => ({
  useOptionalAuthSession,
}));

const placeWithRoadAddress: ProviderPlace = {
  providerPlaceId: "provider-road-1",
  name: "한강 공원 입구",
  category: "공원",
  address: "서울 마포구 망원동 123",
  roadAddress: "서울 마포구 월드컵로 123",
  latitude: 37.555,
  longitude: 126.901,
};

const placeWithAddressOnly: ProviderPlace = {
  providerPlaceId: "provider-address-2",
  name: "한강 공원 입구",
  category: "공원",
  address: "서울 마포구 합정동 456",
  roadAddress: "",
  latitude: 37.549,
  longitude: 126.913,
};

const createdMeetup: Meetup = {
  id: "meetup-1",
  activityCode: "WALK",
  title: "퇴근 후 한강 산책",
  startsAt: "2026-09-07T13:00:30.000Z",
  endsAt: "2026-09-07T14:30:30.000Z",
  minimumParticipants: 3,
  capacity: 6,
  venue: placeWithRoadAddress,
  cost: 0,
  alcoholPolicy: "NOT_ALLOWED",
  state: "OPEN",
  joinedCount: 1,
  version: 1,
  allowedActions: [],
  createdAt: "2026-09-07T10:05:30.000Z",
  updatedAt: "2026-09-07T10:05:30.000Z",
  joinDeadline: "2026-09-07T12:00:30.000Z",
  quorumStatus: "PENDING",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createAuth(
  subject = "user-a",
  overrides: Pick<Partial<AuthSessionContextValue>, "searchPlaces" | "createMeetup"> = {},
): AuthSessionContextValue {
  return {
    snapshot: {
      status: "authenticated",
      user: { id: subject },
    },
    sessionEpoch: 0,
    searchPlaces: vi.fn(),
    createMeetup: vi.fn(),
    ...overrides,
  } as unknown as AuthSessionContextValue;
}

function renderWithAuth(auth: AuthSessionContextValue) {
  useOptionalAuthSession.mockReturnValue(auth);
  return render(<NewMeetupPage />);
}

async function searchFor(query: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "장소 검색" }), { target: { value: query } });
  fireEvent.click(screen.getByRole("button", { name: "서버 장소 검색" }));
}

async function searchAndSelect(place = placeWithRoadAddress) {
  const auth = useOptionalAuthSession.mock.results.at(-1)?.value as AuthSessionContextValue;
  vi.mocked(auth.searchPlaces).mockResolvedValueOnce({ places: [place], page: 1, size: 1, isEnd: true });
  await searchFor("한강");
  await act(async () => {});
  fireEvent.click(screen.getByRole("radio", { name: /한강 공원 입구/ }));
}

function confirmPublicPlace() {
  fireEvent.click(screen.getByRole("checkbox", { name: "누구나 접근할 수 있는 공개 장소임을 확인했어요." }));
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "모임 만들기" }));
}

describe("NewMeetupPage authenticated place and creation regressions", () => {
  beforeEach(() => {
    routerPush.mockReset();
    setNavigationIntent.mockReset();
    useOptionalAuthSession.mockReset();
    useSearchParams.mockImplementation(() => new URLSearchParams(window.location.search));
    window.history.replaceState({}, "", "/meetups/new");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the explicit provider search loading state", async () => {
    const pending = deferred<{ places: ProviderPlace[]; page: number; size: number; isEnd: boolean }>();
    const auth = createAuth("user-a", { searchPlaces: vi.fn().mockReturnValue(pending.promise) });
    renderWithAuth(auth);

    await searchFor("한강");

    expect(screen.getByRole("button", { name: "장소 검색 중…" })).toBeDisabled();
    await act(async () => pending.resolve({ places: [], page: 1, size: 15, isEnd: true }));
  });

  it("explains an empty provider search result", async () => {
    const auth = createAuth("user-a", {
      searchPlaces: vi.fn().mockResolvedValue({ places: [], page: 1, size: 15, isEnd: true }),
    });
    renderWithAuth(auth);

    await searchFor("없는 장소");

    expect(await screen.findByRole("alert")).toHaveTextContent("일치하는 서버 장소가 없어요. 검색어를 바꿔 다시 시도해 주세요.");
  });

  it("shows a provider search problem and retries the explicit search", async () => {
    const auth = createAuth("user-a", {
      searchPlaces: vi.fn()
        .mockRejectedValueOnce(new Error("provider unavailable"))
        .mockResolvedValueOnce({ places: [placeWithRoadAddress], page: 1, size: 15, isEnd: true }),
    });
    renderWithAuth(auth);

    await searchFor("한강");
    expect(await screen.findByRole("alert")).toHaveTextContent("네트워크 상태를 확인한 뒤 다시 시도해 주세요.");

    fireEvent.click(screen.getByRole("button", { name: "서버 장소 검색" }));
    expect(await screen.findByRole("radio", { name: /한강 공원 입구/ })).toBeInTheDocument();
    expect(auth.searchPlaces).toHaveBeenCalledTimes(2);
  });

  it("keys radio selection by providerPlaceId and falls back to address when roadAddress is absent", async () => {
    const auth = createAuth("user-a", {
      searchPlaces: vi.fn().mockResolvedValue({ places: [placeWithRoadAddress, placeWithAddressOnly], page: 1, size: 15, isEnd: true }),
    });
    renderWithAuth(auth);

    await searchFor("한강");
    const radios = await screen.findAllByRole("radio");
    fireEvent.click(radios[1]!);

    expect(radios[0]).not.toBeChecked();
    expect(radios[1]).toBeChecked();
    expect(screen.getAllByText("공원 · 서울 마포구 합정동 456")).toHaveLength(2);
  });

  it("does not create without both a selected provider venue and public-place confirmation", async () => {
    const auth = createAuth("user-a", {
      searchPlaces: vi.fn().mockResolvedValue({ places: [placeWithRoadAddress], page: 1, size: 15, isEnd: true }),
      createMeetup: vi.fn().mockResolvedValue(createdMeetup),
    });
    renderWithAuth(auth);

    await searchFor("한강");
    await screen.findByRole("radio", { name: /한강 공원 입구/ });
    submit();
    expect(auth.createMeetup).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: /한강 공원 입구/ }));
    submit();
    expect(auth.createMeetup).not.toHaveBeenCalled();
  });

  it("posts the exact selected provider venue and absolute timestamps", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T10:05:30.000Z"));
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "create-key-1") });
    const auth = createAuth("user-a", { createMeetup: vi.fn().mockResolvedValue(createdMeetup) });
    renderWithAuth(auth);

    await searchAndSelect(placeWithRoadAddress);
    confirmPublicPlace();
    submit();

    expect(auth.createMeetup).toHaveBeenCalledTimes(1);
    expect(auth.createMeetup).toHaveBeenCalledWith(
      {
        activityCode: "WALK",
        title: "퇴근 후 한강 산책",
        description: "20분 산책 후 카페에서 이야기 나눠요",
        startsAt: "2026-09-07T13:00:30.000Z",
        endsAt: "2026-09-07T14:30:30.000Z",
        minimumParticipants: 3,
        capacity: 6,
        venue: {
          name: "한강 공원 입구",
          address: "서울 마포구 월드컵로 123",
          latitude: 37.555,
          longitude: 126.901,
        },
        cost: 0,
        alcoholPolicy: "NOT_ALLOWED",
        preparation: "",
        facilitationTemplate: "자유 진행",
      },
      "create-key-1",
    );
  });

  it("invalidates a selected venue when the provider query is edited", async () => {
    const auth = createAuth("user-a", { createMeetup: vi.fn().mockResolvedValue(createdMeetup) });
    renderWithAuth(auth);

    await searchAndSelect();
    confirmPublicPlace();
    fireEvent.change(screen.getByRole("textbox", { name: "장소 검색" }), { target: { value: "합정" } });
    submit();

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "누구나 접근할 수 있는 공개 장소임을 확인했어요." })).not.toBeInTheDocument();
    expect(auth.createMeetup).not.toHaveBeenCalled();
  });

  it("keeps only the latest deferred provider search results, loading state, and error", async () => {
    const first = deferred<{ places: ProviderPlace[]; page: number; size: number; isEnd: boolean }>();
    const second = deferred<{ places: ProviderPlace[]; page: number; size: number; isEnd: boolean }>();
    const auth = createAuth("user-a", { searchPlaces: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise) });
    renderWithAuth(auth);

    await searchFor("A");
    fireEvent.change(screen.getByRole("textbox", { name: "장소 검색" }), { target: { value: "B" } });
    fireEvent.click(screen.getByRole("button", { name: "서버 장소 검색" }));
    expect(screen.getByRole("button", { name: "장소 검색 중…" })).toBeDisabled();

    await act(async () => second.resolve({ places: [placeWithAddressOnly], page: 1, size: 15, isEnd: true }));
    expect(screen.getByRole("radio", { name: /서울 마포구 합정동 456/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "서버 장소 검색" })).not.toBeDisabled();

    await act(async () => first.reject(new Error("stale provider failure")));
    expect(screen.getByRole("radio", { name: /서울 마포구 합정동 456/ })).toBeInTheDocument();
    expect(screen.queryByText("stale provider failure")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "서버 장소 검색" })).not.toBeDisabled();
  });

  it("suppresses a pending old-account provider search after an account switch", async () => {
    const pending = deferred<{ places: ProviderPlace[]; page: number; size: number; isEnd: boolean }>();
    const firstAuth = createAuth("user-a", { searchPlaces: vi.fn().mockReturnValue(pending.promise) });
    const secondAuth = createAuth("user-b");
    const view = renderWithAuth(firstAuth);

    await searchFor("한강");
    useOptionalAuthSession.mockReturnValue(secondAuth);
    view.rerender(<NewMeetupPage />);
    await act(async () => pending.resolve({ places: [placeWithRoadAddress], page: 1, size: 15, isEnd: true }));

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByText("한강 공원 입구")).not.toBeInTheDocument();
  });

  it("rejects a cached selection after its absolute start becomes past without sliding it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T10:05:30.000Z"));
    const auth = createAuth("user-a", { createMeetup: vi.fn().mockResolvedValue(createdMeetup) });
    renderWithAuth(auth);

    await searchAndSelect();
    confirmPublicPlace();
    vi.setSystemTime(new Date("2026-09-07T14:05:30.000Z"));
    submit();

    expect(auth.createMeetup).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("선택한 시간이 만료됐어요. 시간을 다시 선택해 주세요.");
  });

  it("rejects a cached selection beyond 24 hours without sliding it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T10:05:30.000Z"));
    const auth = createAuth("user-a", { createMeetup: vi.fn().mockResolvedValue(createdMeetup) });
    renderWithAuth(auth);

    await searchAndSelect();
    confirmPublicPlace();
    vi.setSystemTime(new Date("2026-09-06T12:05:30.000Z"));
    submit();

    expect(auth.createMeetup).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("선택한 시간이 만료됐어요. 시간을 다시 선택해 주세요.");
  });

  it("locks the create fieldset and payload while a deferred post is in flight", async () => {
    const pending = deferred<Meetup>();
    const auth = createAuth("user-a", { createMeetup: vi.fn().mockReturnValue(pending.promise) });
    renderWithAuth(auth);

    await searchAndSelect();
    confirmPublicPlace();
    submit();

    const form = document.getElementById("create-meetup-form")!;
    expect(form).toHaveAttribute("aria-busy", "true");
    expect(form.querySelector("fieldset")).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "모임 제목" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "모임 제목" }), { target: { value: "변경 시도" } });
    expect(auth.createMeetup).toHaveBeenCalledWith(expect.objectContaining({ title: "퇴근 후 한강 산책" }), expect.any(String));

    await act(async () => pending.resolve(createdMeetup));
    expect(await screen.findByRole("heading", { name: "모임을 게시했어요" })).toBeInTheDocument();
  });

  it("sends one request for duplicate submits during an in-flight create", async () => {
    const pending = deferred<Meetup>();
    const auth = createAuth("user-a", { createMeetup: vi.fn().mockReturnValue(pending.promise) });
    renderWithAuth(auth);

    await searchAndSelect();
    confirmPublicPlace();
    const form = document.getElementById("create-meetup-form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(auth.createMeetup).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(createdMeetup));
  });

  it("reuses the idempotency key for an unchanged failed create payload", async () => {
    const auth = createAuth("user-a", {
      createMeetup: vi.fn().mockRejectedValueOnce(new Error("temporary failure")).mockResolvedValueOnce(createdMeetup),
    });
    renderWithAuth(auth);

    await searchAndSelect();
    confirmPublicPlace();
    submit();
    expect(await screen.findByText("네트워크 상태를 확인한 뒤 다시 시도해 주세요.")).toBeInTheDocument();
    submit();

    await waitFor(() => expect(auth.createMeetup).toHaveBeenCalledTimes(2));
    expect(vi.mocked(auth.createMeetup).mock.calls[1]?.[1]).toBe(vi.mocked(auth.createMeetup).mock.calls[0]?.[1]);
  });

  it("uses a new idempotency key after a semantic edit following failure", async () => {
    const auth = createAuth("user-a", {
      createMeetup: vi.fn().mockRejectedValueOnce(new Error("temporary failure")).mockResolvedValueOnce(createdMeetup),
    });
    renderWithAuth(auth);

    await searchAndSelect();
    confirmPublicPlace();
    submit();
    expect(await screen.findByText("네트워크 상태를 확인한 뒤 다시 시도해 주세요.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "모임 제목" }), { target: { value: "수정한 한강 산책" } });
    submit();

    await waitFor(() => expect(auth.createMeetup).toHaveBeenCalledTimes(2));
    expect(vi.mocked(auth.createMeetup).mock.calls[1]?.[0]).toMatchObject({ title: "수정한 한강 산책" });
    expect(vi.mocked(auth.createMeetup).mock.calls[1]?.[1]).not.toBe(vi.mocked(auth.createMeetup).mock.calls[0]?.[1]);
  });

  it("clears a successful create attempt before rendering the confirmed result", async () => {
    const auth = createAuth("user-a", { createMeetup: vi.fn().mockResolvedValue(createdMeetup) });
    renderWithAuth(auth);

    await searchAndSelect();
    confirmPublicPlace();
    submit();

    expect(await screen.findByRole("heading", { name: "모임을 게시했어요" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "모임 만들기" })).not.toBeInTheDocument();
  });

  it("drops a late create receipt after the same subject logs out and back in", async () => {
    const pending = deferred<Meetup>();
    const firstAuth = createAuth("user-a", { createMeetup: vi.fn().mockReturnValue(pending.promise) });
    const secondAuth = { ...createAuth("user-a", { createMeetup: vi.fn().mockResolvedValue(createdMeetup) }), sessionEpoch: 1 };
    const view = renderWithAuth(firstAuth);

    await searchAndSelect();
    confirmPublicPlace();
    submit();

    useOptionalAuthSession.mockReturnValue(secondAuth);
    view.rerender(<NewMeetupPage />);
    await act(async () => pending.resolve(createdMeetup));

    expect(screen.queryByRole("heading", { name: "모임을 게시했어요" })).not.toBeInTheDocument();
    expect(screen.queryByText(createdMeetup.title)).not.toBeInTheDocument();
  });

  it("blocks an offline create and search while keeping the draft", async () => {
    const auth = createAuth("user-a", { createMeetup: vi.fn(), searchPlaces: vi.fn() });
    renderWithAuth(auth);
    await searchAndSelect();
    confirmPublicPlace();
    const submitButton = screen.getByRole("button", { name: "모임 만들기" });
    expect(submitButton).toBeEnabled();
    vi.mocked(auth.searchPlaces).mockClear();

    act(() => setOnline(false));
    expect(screen.getByText("인터넷 연결이 끊겼어요")).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "서버 장소 검색" }));
    expect(vi.mocked(auth.searchPlaces)).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "모임 제목" })).toHaveValue("퇴근 후 한강 산책");

    act(() => setOnline(true));
    await waitFor(() => expect(screen.getByRole("button", { name: "모임 만들기" })).toBeEnabled());
    expect(vi.mocked(auth.createMeetup)).not.toHaveBeenCalled();
    expect(vi.mocked(auth.searchPlaces)).not.toHaveBeenCalled();
  });
});

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
  window.dispatchEvent(new Event(online ? "online" : "offline"));
}
