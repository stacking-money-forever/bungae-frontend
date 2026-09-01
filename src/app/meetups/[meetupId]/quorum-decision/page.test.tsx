import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import QuorumDecisionPage from "./page";

const routerPush = vi.hoisted(() => vi.fn());
const useSearchParams = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useParams: () => ({ meetupId: "demo" }),
  useRouter: () => ({ push: routerPush }),
  useSearchParams: () => useSearchParams(),
}));

describe("QuorumDecisionPage", () => {
  beforeEach(() => {
    routerPush.mockReset();
    window.history.replaceState({}, "", "/meetups/demo/quorum-decision");
    useSearchParams.mockImplementation(() => new URLSearchParams(window.location.search));
  });

  it("uses two participants by default and honors an explicit zero", async () => {
    const { unmount } = render(<QuorumDecisionPage />);

    expect(screen.getByRole("heading", { name: "현재 2명" })).toBeInTheDocument();
    unmount();

    window.history.replaceState(
      {},
      "",
      "/meetups/demo/quorum-decision?participants=0",
    );
    render(<QuorumDecisionPage />);

    expect(screen.getByRole("heading", { name: "현재 0명" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "0명으로 진행하기" }),
    ).toBeDisabled();
  });

  it("commits the cancellation result after the confirmation exits", async () => {
    render(<QuorumDecisionPage />);

    fireEvent.click(screen.getByRole("button", { name: "인원 부족으로 취소하기" }));
    expect(screen.getByRole("dialog", { name: "모임을 취소할까요?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^취소하기$/ }));
    expect(
      screen.queryByRole("heading", { name: "모임을 취소했어요" }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "모임을 취소했어요" })).toBeInTheDocument();
    });
    expect(routerPush).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(document.getElementById("quorum-decision-cancelled-result")).toHaveFocus();
    });
  });

  it("waits for the proceed dialog exit before navigating", async () => {
    render(<QuorumDecisionPage />);

    fireEvent.click(screen.getByRole("button", { name: "2명으로 진행하기" }));
    fireEvent.click(screen.getByRole("button", { name: /^진행하기$/ }));

    expect(routerPush).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith("/meetups/demo/hub?confirmed=1");
    });
  });

  it("restores the dismissed dialog trigger after the exit completes", async () => {
    render(<QuorumDecisionPage />);

    const cancelTrigger = screen.getByRole("button", { name: "인원 부족으로 취소하기" });
    fireEvent.click(cancelTrigger);
    fireEvent.click(screen.getByRole("button", { name: "돌아가기" }));

    expect(cancelTrigger).not.toHaveFocus();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(cancelTrigger).toHaveFocus();
    });
  });
});
