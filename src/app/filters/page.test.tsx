import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FiltersPage from "./page";

const routerPush = vi.hoisted(() => vi.fn());
const setNavigationIntent = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("@/components/navigation-intent", () => ({
  setNavigationIntent,
}));

describe("FiltersPage", () => {
  beforeEach(() => {
    routerPush.mockReset();
    setNavigationIntent.mockReset();
  });

  it("keeps the background inert and updates the availability switch", () => {
    render(<FiltersPage />);

    const background = screen.getByText("마포구 망원동").closest("div");
    expect(background).toHaveAttribute("aria-hidden", "true");
    expect(background).toHaveAttribute("inert");

    const availabilitySwitch = screen.getByRole("switch", {
      name: "참여 가능한 모임만 보기",
    });
    expect(availabilitySwitch).toHaveAttribute("aria-checked", "true");
    fireEvent.click(availabilitySwitch);

    expect(availabilitySwitch).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "결과 4개 보기" })).toBeInTheDocument();
  });

  it("starts on the sheet heading and traps focus within the filter dialog", async () => {
    render(<FiltersPage />);

    const dialog = screen.getByRole("dialog", { name: "필터" });
    const resetButton = screen.getByRole("button", { name: "초기화" });
    const applyButton = screen.getByRole("button", { name: "결과 3개 보기" });

    await waitFor(() => expect(screen.getByRole("heading", { name: "필터" })).toHaveFocus());
    applyButton.focus();
    fireEvent.keyDown(applyButton, { key: "Tab" });
    expect(resetButton).toHaveFocus();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("navigates home only after the sheet exit completes on apply", async () => {
    render(<FiltersPage />);

    fireEvent.click(screen.getByRole("button", { name: "결과 3개 보기" }));

    expect(setNavigationIntent).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "필터" })).toBeInTheDocument();

    await waitFor(() => {
      expect(setNavigationIntent).toHaveBeenCalledWith("sheet", "/");
      expect(routerPush).toHaveBeenCalledWith("/");
    });
  });

  it("uses the same sheet exit path when Escape closes the sheet", async () => {
    render(<FiltersPage />);

    fireEvent.keyDown(screen.getByRole("dialog", { name: "필터" }), { key: "Escape" });

    await waitFor(() => {
      expect(setNavigationIntent).toHaveBeenCalledWith("sheet", "/");
      expect(routerPush).toHaveBeenCalledWith("/");
    });
  });

  it("dismisses from the backdrop through the dialog primitive", async () => {
    render(<FiltersPage />);

    const backdrop = screen.getByTestId("filter-backdrop");
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);

    await waitFor(() => {
      expect(setNavigationIntent).toHaveBeenCalledWith("sheet", "/");
      expect(routerPush).toHaveBeenCalledWith("/");
    });
  });
});
