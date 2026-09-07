import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PersistentBottomNavigation } from "./persistent-bottom-navigation";

const usePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

describe("PersistentBottomNavigation", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/my-meetups");
  });

  it("keeps one tab bar with the current root selected", () => {
    render(<PersistentBottomNavigation />);

    expect(screen.getAllByRole("navigation", { name: "주요 메뉴" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "내 모임" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps explore chrome mounted behind the filter sheet", () => {
    usePathname.mockReturnValue("/filters");
    render(<PersistentBottomNavigation />);

    const navigation = screen.getByRole("navigation", { name: "주요 메뉴", hidden: true });
    expect(navigation).toBeInTheDocument();
    expect(navigation.parentElement).toHaveAttribute("aria-hidden", "true");
    expect(navigation.parentElement).toHaveAttribute("inert");
    expect(screen.getByRole("link", { name: "탐색", hidden: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("removes the tab bar from pushed screens", () => {
    usePathname.mockReturnValue("/meetups/demo");
    render(<PersistentBottomNavigation />);

    expect(screen.queryByRole("navigation", { name: "주요 메뉴" })).not.toBeInTheDocument();
  });

  it("removes the tab bar from the authentication route", () => {
    usePathname.mockReturnValue("/auth");
    render(<PersistentBottomNavigation />);

    expect(screen.queryByRole("navigation", { name: "주요 메뉴" })).not.toBeInTheDocument();
  });

  it("rerenders the same mounted tab bar across filter and root routes", async () => {
    const { rerender } = render(<PersistentBottomNavigation />);

    usePathname.mockReturnValue("/filters");
    rerender(<PersistentBottomNavigation />);
    await waitFor(() => {
      expect(screen.getAllByRole("navigation", { name: "주요 메뉴", hidden: true })).toHaveLength(1);
      expect(screen.getByRole("navigation", { name: "주요 메뉴", hidden: true }).parentElement).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    });

    usePathname.mockReturnValue("/");
    rerender(<PersistentBottomNavigation />);
    await waitFor(() => {
      expect(screen.getAllByRole("navigation", { name: "주요 메뉴" })).toHaveLength(1);
      expect(screen.getByRole("link", { name: "탐색" })).toHaveAttribute("aria-current", "page");
    });
  });
});
