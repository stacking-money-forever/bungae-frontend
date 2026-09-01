import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MatchedConnectionPage from "./page";

vi.mock("next/navigation", () => ({
  useParams: () => ({ meetupId: "demo" }),
}));

describe("MatchedConnectionPage", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/meetups/demo/connections/matched");
  });

  it("commits the blocked state after the confirmation exits", async () => {
    render(<MatchedConnectionPage />);

    fireEvent.click(screen.getByRole("button", { name: /^차단하기$/ }));
    expect(screen.getByRole("dialog", { name: "이 연결을 차단할까요?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^차단하기$/ }));
    expect(
      screen.queryByRole("heading", { name: "연결을 종료했어요" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "1:1 대화 시작하기", hidden: true }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "연결을 종료했어요" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "확인했어요" })).toBeInTheDocument();
    await waitFor(() => {
      expect(document.getElementById("matched-blocked-result")).toHaveFocus();
    });
  });

  it("restores the block trigger after a dismissal exits", async () => {
    render(<MatchedConnectionPage />);

    const blockTrigger = screen.getByRole("button", { name: /^차단하기$/ });
    fireEvent.click(blockTrigger);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(blockTrigger).not.toHaveFocus();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(blockTrigger).toHaveFocus();
    });
  });
});
