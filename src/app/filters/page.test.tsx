import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FiltersPage from "./page";

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

describe("FiltersPage", () => {
  beforeEach(() => {
    routerPush.mockReset();
    setNavigationIntent.mockReset();
    useSearchParams.mockImplementation(() => new URLSearchParams(window.location.search));
    window.history.replaceState({}, "", "/filters");
  });

  it("restores the active filters when the sheet is reopened from a query", () => {
    window.history.replaceState({}, "", "/filters?location=%EB%A7%88%ED%8F%AC%EA%B5%AC+%ED%95%A9%EC%A0%95%EB%8F%99&activity=%EC%82%B0%EC%B1%85&available=1");
    render(<FiltersPage />);

    expect(screen.getByTestId("filter-home-surface")).toHaveTextContent("마포구 합정동");
    expect(screen.getByRole("combobox", { name: "활동 필터" })).toHaveValue("산책");
    expect(screen.getByRole("switch", { name: "참여 가능한 모임만 보기" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("button", { name: "필터 적용" })).toBeInTheDocument();
  });

  it("falls back to visible defaults for invalid shared query values", () => {
    window.history.replaceState({}, "", "/filters?activity=NOPE&distance=garbage&available=2");
    render(<FiltersPage />);

    expect(screen.getByRole("combobox", { name: "활동 필터" })).toHaveValue("전체");
    expect(screen.getByRole("combobox", { name: "거리 필터" })).toHaveValue("2km 이내");
    expect(screen.getByRole("switch", { name: "참여 가능한 모임만 보기" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByRole("button", { name: "필터 적용" })).toBeInTheDocument();
  });

  it("keeps the background inert and updates the availability switch", () => {
    render(<FiltersPage />);

    const background = screen.getByTestId("filter-home-surface");
    expect(background).toHaveAttribute("aria-hidden", "true");
    expect(background).toHaveAttribute("inert");
    expect(
      screen.getByRole("link", { name: "동네 변경, 현재 마포구 망원동", hidden: true }),
    ).toBeInTheDocument();

    const availabilitySwitch = screen.getByRole("switch", {
      name: "참여 가능한 모임만 보기",
    });
    expect(availabilitySwitch).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "필터 적용" })).toBeInTheDocument();
    fireEvent.click(availabilitySwitch);

    expect(availabilitySwitch).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "필터 적용" })).toBeInTheDocument();
  });

  it("starts on the first interactive filter and traps focus within the dialog", async () => {
    render(<FiltersPage />);

    const dialog = screen.getByRole("dialog", { name: "필터" });
    const resetButton = screen.getByRole("button", { name: "초기화" });
    const applyButton = screen.getByRole("button", { name: "필터 적용" });

    await waitFor(() => expect(screen.getByRole("combobox", { name: "활동 필터" })).toHaveFocus());
    applyButton.focus();
    fireEvent.keyDown(applyButton, { key: "Tab" });
    expect(resetButton).toHaveFocus();
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("navigates home only after the sheet exit completes on apply", async () => {
    render(<FiltersPage />);

    fireEvent.click(screen.getByRole("button", { name: "필터 적용" }));

    expect(setNavigationIntent).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "필터" })).toBeInTheDocument();

    await waitFor(() => {
      expect(setNavigationIntent).toHaveBeenCalledWith("sheet", "/");
      expect(routerPush).toHaveBeenCalledWith("/");
    });
  });

  it("does not show a fabricated result count while the draft changes", () => {
    render(<FiltersPage />);

    expect(screen.queryByRole("button", { name: /결과 \d+개 보기/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/모임 \d+개/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "활동 필터" }), {
      target: { value: "산책" },
    });
    expect(screen.getByRole("button", { name: "필터 적용" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /결과 \d+개 보기/ })).not.toBeInTheDocument();
  });

  it("serializes the selected draft into the home query on apply", async () => {
    render(<FiltersPage />);

    fireEvent.change(screen.getByRole("combobox", { name: "활동 필터" }), {
      target: { value: "산책" },
    });
    fireEvent.click(screen.getByRole("button", { name: "필터 적용" }));
    await waitFor(() => {
      expect(setNavigationIntent).toHaveBeenCalledWith("sheet", "/?activity=%EC%82%B0%EC%B1%85");
      expect(routerPush).toHaveBeenCalledWith("/?activity=%EC%82%B0%EC%B1%85");
    });
  });

  it("restores a refreshed query without treating the draft as an apply", async () => {
    const view = render(<FiltersPage />);

    window.history.replaceState({}, "", "/filters?activity=%EC%82%B0%EC%B1%85");
    view.rerender(<FiltersPage />);

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "활동 필터" })).toHaveValue("산책");
      expect(screen.getByRole("button", { name: "필터 적용" })).toBeInTheDocument();
    });
  });

  it("uses the same sheet exit path when Escape closes the sheet", async () => {
    render(<FiltersPage />);

    fireEvent.change(screen.getByRole("combobox", { name: "활동 필터" }), {
      target: { value: "산책" },
    });
    fireEvent.keyDown(screen.getByRole("dialog", { name: "필터" }), { key: "Escape" });

    await waitFor(() => {
      expect(setNavigationIntent).toHaveBeenCalledWith("sheet", "/");
      expect(routerPush).toHaveBeenCalledWith("/");
    });
  });

  it("dismisses from the backdrop through the dialog primitive", async () => {
    render(<FiltersPage />);

    const backdrop = document.querySelector('[data-state="open"].fixed.inset-0');
    expect(backdrop).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.pointerDown(backdrop as HTMLElement);
    fireEvent.click(backdrop as HTMLElement);

    await waitFor(() => {
      expect(setNavigationIntent).toHaveBeenCalledWith("sheet", "/");
      expect(routerPush).toHaveBeenCalledWith("/");
    });
  });
});
