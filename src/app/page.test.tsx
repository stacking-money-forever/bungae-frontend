import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HomePage from "./page";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth/auth-session-provider", () => ({
  useOptionalAuthSession: () => ({ snapshot: { status: "anonymous", user: null } }),
}));

describe("HomePage", () => {
  it("renders the discovery chrome without fixture rows, images, or counts", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: "벙개 홈" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "동네 변경, 현재 마포구 망원동" })).toHaveAttribute(
      "href",
      "/locations",
    );
    expect(screen.getByRole("link", { name: "필터 변경" })).toHaveAttribute("href", "/filters");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText(/모임 \d+개/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "오늘 저녁" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /월드컵공원/ })).not.toBeInTheDocument();
  });

  it("offers an honest sign-in route instead of invented anonymous results", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "로그인 후 모임을 찾아볼 수 있어요" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인하기" })).toHaveAttribute("href", "/auth");
  });
});
