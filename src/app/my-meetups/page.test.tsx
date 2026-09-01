import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MyMeetupsPage from "./page";

describe("MyMeetupsPage", () => {
  it("renders a root list without pushed-screen navigation", () => {
    render(<MyMeetupsPage />);

    expect(screen.getByRole("heading", { name: "내 모임" })).toBeInTheDocument();
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
