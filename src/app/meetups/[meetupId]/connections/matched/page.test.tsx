import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MatchedConnectionPage from "./page";

vi.mock("next/navigation", () => ({ useParams: () => ({ meetupId: "demo" }) }));

describe("MatchedConnectionPage", () => {
  it("discloses the missing connection detail and messaging contracts without inventing data", () => {
    render(<MatchedConnectionPage />);

    expect(screen.getByRole("heading", { name: "연결 상세는 아직 제공되지 않아요." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "연결 목록으로" })).toHaveAttribute("href", "/connections");
    expect(screen.queryByText("가짜 상대방")).not.toBeInTheDocument();
    expect(screen.queryByText("가짜 매치 영수증")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /대화|메시지|신고|차단/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /대화|메시지|신고|차단/ })).not.toBeInTheDocument();
  });
});
