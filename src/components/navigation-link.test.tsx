import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setNavigationIntent = vi.hoisted(() => vi.fn());

vi.mock("@/components/navigation-intent", () => ({
  setNavigationIntent,
}));

vi.mock("next/link", () => ({
  default: function MockLink({
    children,
    href,
    onClick,
    onNavigate,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
    onNavigate?: (event: { preventDefault: () => void }) => void;
    [key: string]: unknown;
  }) {
    return (
      <a
        {...props}
        href={href}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) {
            return;
          }

          event.preventDefault();
          onNavigate?.({ preventDefault: () => undefined });
        }}
      >
        {children}
      </a>
    );
  },
}));

import { NavigationLink } from "./navigation-link";

describe("NavigationLink", () => {
  beforeEach(() => {
    setNavigationIntent.mockReset();
  });

  it("records an intent only after Next confirms the navigation", () => {
    render(
      <NavigationLink href="/filters" navigationIntent="sheet">
        필터 열기
      </NavigationLink>,
    );

    fireEvent.click(screen.getByRole("link", { name: "필터 열기" }));

    expect(setNavigationIntent).toHaveBeenCalledWith("sheet", "/filters");
  });

  it("does not record an intent when a React click handler prevents navigation", () => {
    render(
      <NavigationLink
        href="/filters"
        navigationIntent="sheet"
        onClick={(event) => event.preventDefault()}
      >
        필터 열기
      </NavigationLink>,
    );

    fireEvent.click(screen.getByRole("link", { name: "필터 열기" }));

    expect(setNavigationIntent).not.toHaveBeenCalled();
  });

  it("does not record an intent when the onNavigate lifecycle is cancelled", () => {
    render(
      <NavigationLink
        href="/filters"
        navigationIntent="sheet"
        onNavigate={(event) => event.preventDefault()}
      >
        필터 열기
      </NavigationLink>,
    );

    fireEvent.click(screen.getByRole("link", { name: "필터 열기" }));

    expect(setNavigationIntent).not.toHaveBeenCalled();
  });
});
