import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LocationsPage from "./page";

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

describe("LocationsPage", () => {
  beforeEach(() => {
    routerPush.mockReset();
    setNavigationIntent.mockReset();
    useSearchParams.mockImplementation(() => new URLSearchParams(window.location.search));
    window.history.replaceState({}, "", "/locations");
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
  });

  it("opens a dedicated location sheet and focuses its search field", async () => {
    render(<LocationsPage />);

    expect(screen.getByRole("dialog", { name: "동네 바꾸기" })).toBeInTheDocument();
    expect(screen.getByTestId("location-home-surface")).toHaveAttribute("inert");
    await waitFor(() => expect(screen.getByRole("searchbox", { name: "동네 검색" })).toHaveFocus());
  });

  it("applies a selected neighborhood while preserving the other filters", async () => {
    window.history.replaceState({}, "", "/locations?activity=%EC%82%B0%EC%B1%85");
    render(<LocationsPage />);

    fireEvent.click(screen.getByRole("radio", { name: /마포구 합정동/ }));
    fireEvent.click(screen.getByRole("button", { name: "이 동네에서 보기" }));

    await waitFor(() => {
      expect(setNavigationIntent).toHaveBeenCalledWith(
        "sheet",
        "/?location=%EB%A7%88%ED%8F%AC%EA%B5%AC+%ED%95%A9%EC%A0%95%EB%8F%99&activity=%EC%82%B0%EC%B1%85",
      );
      expect(routerPush).toHaveBeenCalledWith(
        "/?location=%EB%A7%88%ED%8F%AC%EA%B5%AC+%ED%95%A9%EC%A0%95%EB%8F%99&activity=%EC%82%B0%EC%B1%85",
      );
    });
  });

  it("filters the local neighborhood choices without losing the current selection", () => {
    render(<LocationsPage />);

    fireEvent.change(screen.getByRole("searchbox", { name: "동네 검색" }), {
      target: { value: "연남" },
    });

    expect(screen.getByRole("radio", { name: /마포구 연남동/ })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /마포구 망원동/ })).not.toBeInTheDocument();
  });

  it("updates the background chrome from the selected neighborhood without a fixture count", () => {
    render(<LocationsPage />);

    fireEvent.click(screen.getByRole("radio", { name: /마포구 합정동/ }));

    expect(screen.getByTestId("location-home-surface")).toHaveTextContent("마포구 합정동");
    expect(screen.queryByText(/모임 \d+개/)).not.toBeInTheDocument();
    expect(screen.queryByText(/모임 \d+개를 볼 수 있어요/)).not.toBeInTheDocument();
  });

  it("restores a refreshed location query and cancels to that source route", async () => {
    const view = render(<LocationsPage />);

    window.history.replaceState(
      {},
      "",
      "/locations?location=%EB%A7%88%ED%8F%AC%EA%B5%AC+%EC%97%B0%EB%82%A8%EB%8F%99&activity=%EC%82%B0%EC%B1%85",
    );
    view.rerender(<LocationsPage />);

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /마포구 연남동/ })).toBeChecked();
    });
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    await waitFor(() => {
      expect(setNavigationIntent).toHaveBeenCalledWith(
        "sheet",
        "/?location=%EB%A7%88%ED%8F%AC%EA%B5%AC+%EC%97%B0%EB%82%A8%EB%8F%99&activity=%EC%82%B0%EC%B1%85",
      );
    });
  });

  it("announces empty searches without requesting location permission", async () => {
    render(<LocationsPage />);

    fireEvent.change(screen.getByRole("searchbox", { name: "동네 검색" }), {
      target: { value: "없는 동네" },
    });
    expect(screen.getByText("검색 결과가 없어요. 다른 동네 이름을 입력해 주세요.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "확인" })).not.toBeInTheDocument();
    expect(screen.queryByText("현재 위치 권한")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "동네 검색" }), {
      target: { value: "" },
    });
    expect(screen.getByRole("radio", { name: /마포구 망원동/ })).toBeChecked();
  });
});
