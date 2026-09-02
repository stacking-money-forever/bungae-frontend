import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInitialValues, createTimeOptions, initialValues, validateMeetupForm } from "@/lib/meetup-form";

import NewMeetupPage from "./page";

const routerPush = vi.hoisted(() => vi.fn());
const setNavigationIntent = vi.hoisted(() => vi.fn());
const useSearchParams = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
  useSearchParams: () => useSearchParams(),
}));

vi.mock("@/components/navigation-intent", () => ({
  setNavigationIntent,
}));

describe("NewMeetupPage", () => {
  beforeEach(() => {
    routerPush.mockReset();
    setNavigationIntent.mockReset();
    useSearchParams.mockImplementation(() => new URLSearchParams(window.location.search));
    window.history.replaceState({}, "", "/meetups/new");
  });

  it("commits the posted result when the posted search entry arrives", async () => {
    const { rerender } = render(<NewMeetupPage />);

    fireEvent.click(screen.getByRole("button", { name: "모임 만들기" }));

    expect(setNavigationIntent).toHaveBeenCalledWith("push", "/meetups/new?posted=1");
    expect(routerPush).toHaveBeenCalledWith("/meetups/new?posted=1");
    expect(screen.queryByRole("heading", { name: "모임을 게시했어요" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "게시 중…" })).toBeDisabled();

    window.history.pushState({}, "", "/meetups/new?posted=1");
    rerender(<NewMeetupPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "모임을 게시했어요" })).toBeInTheDocument();
    });
  });

  it("renders the posted result from the query on the first render", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-02T14:10:00+09:00"));
    window.history.replaceState({}, "", "/meetups/new?posted=1");

    render(<NewMeetupPage />);

    expect(screen.getByRole("heading", { name: "모임을 게시했어요" })).toBeInTheDocument();
    expect(screen.getByText("오늘 17:00 · 망원한강공원")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "모임 만들기" })).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("builds the wheel from the current half-hour instead of a fixed clock", () => {
    const afternoon = createTimeOptions(new Date("2026-09-02T14:10:00+09:00"));
    const lateNight = createTimeOptions(new Date("2026-09-02T23:50:00+09:00"));

    expect(afternoon[0]).toMatchObject({ label: "오늘 14:30", offsetMinutes: 20 });
    expect(createInitialValues(afternoon).start).toBe("offset-170");
    expect(lateNight[0]).toMatchObject({ label: "내일 00:00", offsetMinutes: 10 });

    const boundary = createTimeOptions(new Date("2026-09-02T14:30:15+09:00"));
    expect(boundary[0]).toMatchObject({ label: "오늘 15:00", offsetMinutes: 30 });
    expect(boundary.filter((option) => option.offsetMinutes <= 24 * 60).at(-1)?.offsetMinutes)
      .toBeLessThanOrEqual(24 * 60);
  });

  it("shows clear editable fields and blocks invalid people limits", async () => {
    render(<NewMeetupPage />);

    fireEvent.change(screen.getByRole("textbox", { name: "모임 제목" }), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "최소 성사 인원" }), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "정원" }), {
      target: { value: "9" },
    });
    fireEvent.click(screen.getByRole("button", { name: "모임 만들기" }));

    expect(screen.getByRole("alert")).toHaveTextContent("3개 항목을 확인해 주세요.");
    expect(screen.getByText("모임 제목을 입력해 주세요.", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("최소 성사 인원은 2명 이상이어야 해요.", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("정원은 최소 인원 이상, 최대 8명이어야 해요.", { selector: "span" })).toBeInTheDocument();
    expect(routerPush).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("textbox", { name: "모임 제목" })).toHaveFocus());
  });

  it("validates time order, 24-hour start bound, deadline, and public place", () => {
    expect(validateMeetupForm(initialValues)).toEqual({});

    expect(
      validateMeetupForm({
        ...initialValues,
        start: "offset-1500",
        end: "offset-120",
        place: null,
        minimum: "1",
        capacity: "9",
      }),
    ).toMatchObject({
      start: "시작 시간은 생성 시점부터 24시간 안이어야 해요.",
      end: "종료 시간은 시작 시간보다 늦어야 해요.",
      place: "누구나 접근할 수 있는 공개 장소를 선택해 주세요.",
      minimum: "최소 성사 인원은 2명 이상이어야 해요.",
      capacity: "정원은 최소 인원 이상, 최대 8명이어야 해요.",
    });

    expect(
      validateMeetupForm({
        ...initialValues,
        deadline: "offset-180",
      }),
    ).toMatchObject({
      deadline: "확정 마감은 시작 시간보다 늦을 수 없어요.",
    });
  });
});
