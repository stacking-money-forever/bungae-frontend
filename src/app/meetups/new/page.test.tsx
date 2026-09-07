import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { createInitialValues, createTimeOptions, initialValues, validateMeetupForm } from "@/lib/meetup-form";

import NewMeetupPage from "./page";

describe("NewMeetupPage", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/meetups/new");
  });

  it("does not turn a posted query into an anonymous creation receipt", () => {
    window.history.replaceState({}, "", "/meetups/new?posted=1");
    render(<NewMeetupPage />);

    expect(screen.getByRole("heading", { name: "로그인하고 모임을 만들어 주세요" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "모임을 게시했어요" })).not.toBeInTheDocument();
    expect(screen.queryByText("데모 게시 화면이에요")).not.toBeInTheDocument();
  });

  it("keeps the anonymous create route behind phone login", () => {
    render(<NewMeetupPage />);

    expect(screen.getByRole("link", { name: "휴대전화로 로그인하기" })).toHaveAttribute("href", "/auth");
    expect(screen.queryByRole("button", { name: "모임 만들기" })).not.toBeInTheDocument();
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

  it("retains creation validation for the authenticated server flow", () => {
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
