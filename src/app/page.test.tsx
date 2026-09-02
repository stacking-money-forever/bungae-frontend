import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HomePage from "./page";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe("HomePage", () => {
  it("groups meetups by time and gives every meetup an activity image", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "오늘 저녁" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "오늘 밤" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "내일 오전" })).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(6);
    expect(
      within(screen.getByRole("region", { name: "오늘 밤" })).getByRole("link", {
        name: /22:00 월드컵공원 야간 산책/,
      }),
    ).toHaveAttribute("href", "/meetups/world-cup-park-night-walk");
    expect(
      within(screen.getByRole("region", { name: "내일 오전" })).getByText("2명 부족"),
    ).toBeInTheDocument();
    expect(screen.getAllByAltText("저녁의 한강변 공개 산책로")[0].getAttribute("src")).toContain(
      "han-river-walk-grid.jpg",
    );
  });
});
