import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MyMeetupsPage from "./page";

describe("MyMeetupsPage", () => {
  it("renders a root list instead of deep-linking the primary tab to one meetup", () => {
    render(<MyMeetupsPage />);

    const myMeetupsTab = screen.getByRole("link", { name: "내 모임" });
    expect(myMeetupsTab).toHaveAttribute("href", "/my-meetups");
    expect(myMeetupsTab).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "뒤로가기" })).not.toBeInTheDocument();

    expect(screen.getByRole("link", { name: /퇴근 후 한강 산책/ })).toHaveAttribute(
      "href",
      "/meetups/demo/hub",
    );
    expect(screen.getByRole("link", { name: /상수 카페 대화/ })).toHaveAttribute(
      "href",
      "/meetups/sangsu-cafe-chat/waitlist",
    );
    expect(screen.getByRole("link", { name: /합정 보드게임/ })).toHaveAttribute(
      "href",
      "/meetups/hapjeong-board-games/feedback",
    );
  });
});
