import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TAB_GESTURE_EVENT, type TabGestureDetail } from "./navigation-gestures";
import { BottomNavigation } from "./bottom-navigation";

const usePathname = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

describe("BottomNavigation gestures", () => {
  beforeEach(() => usePathname.mockReturnValue("/"));

  it("commits a left drag to the adjacent tab", () => {
    const events: TabGestureDetail[] = [];
    const listener = (event: Event) => {
      events.push((event as CustomEvent<TabGestureDetail>).detail);
    };
    window.addEventListener(TAB_GESTURE_EVENT, listener);
    render(<BottomNavigation activeTab="explore" />);
    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });

    fireEvent.pointerDown(navigation, { pointerId: 1, button: 0, isPrimary: true, clientX: 260, clientY: 20 });
    fireEvent.pointerMove(navigation, { pointerId: 1, isPrimary: true, clientX: 130, clientY: 24 });
    fireEvent.pointerUp(navigation, { pointerId: 1, button: 0, isPrimary: true, clientX: 130, clientY: 24 });

    expect(events.at(-1)).toEqual({ phase: "commit", direction: 1, target: "/my-meetups" });
    window.removeEventListener(TAB_GESTURE_EVENT, listener);
  });

  it("cancels when the gesture locks vertically", () => {
    const events: TabGestureDetail[] = [];
    const listener = (event: Event) => {
      events.push((event as CustomEvent<TabGestureDetail>).detail);
    };
    window.addEventListener(TAB_GESTURE_EVENT, listener);
    render(<BottomNavigation activeTab="explore" />);
    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });

    fireEvent.pointerDown(navigation, { pointerId: 2, button: 0, isPrimary: true, clientX: 220, clientY: 20 });
    fireEvent.pointerMove(navigation, { pointerId: 2, isPrimary: true, clientX: 210, clientY: 90 });
    fireEvent.pointerUp(navigation, { pointerId: 2, button: 0, isPrimary: true, clientX: 210, clientY: 90 });

    expect(events.at(-1)).toEqual({ phase: "cancel" });
    window.removeEventListener(TAB_GESTURE_EVENT, listener);
  });

  it("does not consume the next intentional click after pointer cancellation", () => {
    render(<BottomNavigation activeTab="explore" />);
    const navigation = screen.getByRole("navigation", { name: "주요 메뉴" });

    fireEvent.pointerDown(navigation, { pointerId: 3, button: 0, isPrimary: true, clientX: 250, clientY: 20 });
    fireEvent.pointerMove(window, { pointerId: 3, isPrimary: true, clientX: 220, clientY: 20 });
    fireEvent.pointerCancel(window, { pointerId: 3, isPrimary: true, clientX: 0, clientY: 0 });

    const notificationsLink = screen.getByRole("link", { name: "알림" });
    let clickReachedLink = false;
    notificationsLink.addEventListener("click", (event) => {
      clickReachedLink = true;
      event.preventDefault();
    });
    fireEvent.click(notificationsLink);
    expect(clickReachedLink).toBe(true);
  });
});
