import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import QuorumUpdatePage from "./page";

const useSearchParams = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useParams: () => ({ meetupId: "demo" }),
  useSearchParams: () => useSearchParams(),
}));

describe("QuorumUpdatePage", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/meetups/demo/quorum-update");
    useSearchParams.mockImplementation(() => new URLSearchParams(window.location.search));
  });

  it("renders the participant count from the query on the first render", () => {
    window.history.replaceState({}, "", "/meetups/demo/quorum-update?participants=0");

    render(<QuorumUpdatePage />);

    expect(screen.getByRole("heading", { name: "0명으로 진행해요" })).toBeInTheDocument();
  });

  it("commits the participant cancellation after the confirmation exits", async () => {
    render(<QuorumUpdatePage />);

    fireEvent.click(screen.getByRole("button", { name: "불이익 없이 취소하기" }));
    expect(screen.getByRole("dialog", { name: "참여를 취소할까요?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^취소하기$/ }));
    expect(
      screen.queryByRole("heading", { name: "참여를 취소했어요" }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "참여를 취소했어요" })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(document.getElementById("quorum-update-cancelled-result")).toHaveFocus();
    });
  });

  it("restores the cancel trigger only after a dialog dismissal exits", async () => {
    render(<QuorumUpdatePage />);

    const cancelTrigger = screen.getByRole("button", { name: "불이익 없이 취소하기" });
    fireEvent.click(cancelTrigger);
    fireEvent.click(screen.getByRole("button", { name: "돌아가기" }));

    expect(cancelTrigger).not.toHaveFocus();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(cancelTrigger).toHaveFocus();
    });
  });
});
