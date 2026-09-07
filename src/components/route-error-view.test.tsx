import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RouteErrorView } from "./route-error-view";

describe("RouteErrorView", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("labels the alert with a privacy-safe message and never shows raw errors", () => {
    render(<RouteErrorView label="화면을 표시하지 못했어요" description="다시 시도해 주세요." />);

    expect(screen.getByRole("alert")).toHaveTextContent("화면을 표시하지 못했어요");
    expect(screen.getByRole("alert")).toHaveTextContent("다시 시도해 주세요.");
    expect(screen.queryByText(/TypeError|digest|stack|secret/)).not.toBeInTheDocument();
  });

  it("focuses the heading on mount", () => {
    render(<RouteErrorView label="화면을 표시하지 못했어요" />);
    expect(screen.getByRole("heading", { name: "화면을 표시하지 못했어요" })).toHaveFocus();
  });

  it("wires reset to the boundary reset and an escape link to a safe route", () => {
    const onReset = vi.fn();
    render(
      <RouteErrorView
        label="화면을 표시하지 못했어요"
        onReset={() => onReset()}
        escapeHref="/my-meetups"
        escapeLabel="내 모임 보기"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "내 모임 보기" })).toHaveAttribute(
      "href",
      "/my-meetups",
    );
  });

  it("omits the retry affordance when no reset is available", () => {
    render(<RouteErrorView label="화면을 표시하지 못했어요" escapeHref="/" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈으로 돌아가기" })).toBeInTheDocument();
  });
});
