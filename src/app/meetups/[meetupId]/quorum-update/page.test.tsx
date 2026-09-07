import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import QuorumUpdatePage from "./page";

const useSearchParams = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useParams: () => ({ meetupId: "demo" }),
  useSearchParams: () => useSearchParams(),
}));

describe("QuorumUpdatePage", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/meetups/demo/quorum-update?participants=0&confirmed=1");
    useSearchParams.mockImplementation(() => new URLSearchParams(window.location.search));
  });

  it("does not turn query values into a quorum result", () => {
    render(<QuorumUpdatePage />);

    expect(screen.getByRole("heading", { name: "최신 모임 상태를 확인해 주세요" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "0명으로 진행해요" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "참여를 취소했어요" })).not.toBeInTheDocument();
  });

  it("has no local cancellation control", () => {
    render(<QuorumUpdatePage />);

    expect(screen.queryByRole("button", { name: "불이익 없이 취소하기" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "모임 상세에서 최신 상태 확인하기" })).toHaveAttribute("href", "/meetups/demo");
  });
});
