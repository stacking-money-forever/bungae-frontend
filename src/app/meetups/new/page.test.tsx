import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewMeetupPage from "./page";

const routerPush = vi.hoisted(() => vi.fn());
const setNavigationIntent = vi.hoisted(() => vi.fn());
const useSearchParams = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
  useSearchParams: () => useSearchParams(),
}));

vi.mock("@/components/navigation-intent", () => ({
  setNavigationIntent,
}));

describe("NewMeetupPage", () => {
  beforeEach(() => {
    routerPush.mockReset();
    setNavigationIntent.mockReset();
    useSearchParams.mockImplementation(() => new URLSearchParams(window.location.search));
    window.history.replaceState({}, "", "/meetups/new");
  });

  it("commits the posted result when the posted search entry arrives", async () => {
    const { rerender } = render(<NewMeetupPage />);

    fireEvent.click(screen.getByRole("button", { name: "모임 만들기" }));

    expect(setNavigationIntent).toHaveBeenCalledWith("push", "/meetups/new?posted=1");
    expect(routerPush).toHaveBeenCalledWith("/meetups/new?posted=1");
    expect(screen.queryByRole("heading", { name: "모임을 게시했어요" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "게시 중…" })).toBeDisabled();

    window.history.pushState({}, "", "/meetups/new?posted=1");
    rerender(<NewMeetupPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "모임을 게시했어요" })).toBeInTheDocument();
    });
  });

  it("renders the posted result from the query on the first render", () => {
    window.history.replaceState({}, "", "/meetups/new?posted=1");

    render(<NewMeetupPage />);

    expect(screen.getByRole("heading", { name: "모임을 게시했어요" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "모임 만들기" })).not.toBeInTheDocument();
  });
});
