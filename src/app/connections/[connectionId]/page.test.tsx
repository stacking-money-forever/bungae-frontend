import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@testing-library/react";

import ConnectionDetailPage from "./page";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe("ConnectionDetailPage unavailable surface", () => {
  it("renders an honest unavailable state without inventing a counterpart or send success", () => {
    render(<ConnectionDetailPage />);

    expect(screen.getByRole("heading", { name: "연결 상세를 확인할 수 없어요" })).toBeInTheDocument();
    expect(screen.getByText("1:1 메시지 보내기는 아직 제공되지 않아요.")).toBeInTheDocument();
    expect(screen.getByText("실시간 대화 알림은 아직 제공되지 않아요.")).toBeInTheDocument();
    expect(screen.getByText("상대 신고·차단은 상대 정보가 준비된 뒤에 이용할 수 있어요.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "연결 목록으로" })).toHaveAttribute("href", "/connections");
    expect(screen.getByRole("link", { name: "홈으로" })).toHaveAttribute("href", "/");
    expect(screen.queryByText("가짜 상대")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /메시지 보내기|신고|차단/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
