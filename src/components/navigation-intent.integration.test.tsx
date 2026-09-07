import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const usePathname = vi.hoisted(() => vi.fn());
const useSearchParams = vi.hoisted(() => vi.fn());
const routerPush = vi.hoisted(() => vi.fn());
const routerBack = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
  useSearchParams: () => useSearchParams(),
  useRouter: () => ({ push: routerPush, back: routerBack }),
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

          // Mirror Next Link: the browser default is cancelled before the
          // onNavigate lifecycle is offered to the consumer.
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
import { PageTransition } from "./page-transition";

describe("NavigationLink and PageTransition", () => {
  beforeEach(() => {
    usePathname.mockImplementation(() => window.location.pathname);
    useSearchParams.mockImplementation(() => new URLSearchParams(window.location.search));
    routerPush.mockReset();
    routerBack.mockReset();
    window.history.replaceState({}, "", "/");
  });

  it.each([
    ["tab", "/my-meetups", "내 모임"],
    ["sheet", "/filters", "필터"],
    ["pop", "/", "홈"],
  ] as const)(
    "commits the %s intent when the router renders before the address bar update",
    async (intent, destination, label) => {
      const source = "/source";
      window.history.replaceState({}, "", source);
      usePathname.mockReturnValue(source);

      const { container, rerender } = render(
        <PageTransition>
          <NavigationLink href={destination} navigationIntent={intent}>
            {label} 이동
          </NavigationLink>
        </PageTransition>,
      );

      await waitFor(() => expect(window.history.state?.__bungae_navigation?.index).toBe(0));

      fireEvent.click(screen.getByRole("link", { name: `${label} 이동` }));

      // App Router can publish the destination pathname before its history
      // updater has committed the address bar. The transition must still use
      // the intent confirmed by Link's onNavigate callback.
      usePathname.mockReturnValue(destination);
      rerender(
        <PageTransition>
          <p>{label} 화면</p>
        </PageTransition>,
      );

      await waitFor(() => {
        expect(container.querySelector(".route-transition")).toHaveAttribute(
          "data-navigation-intent",
          intent,
        );
      });

      // Finish the simulated address-bar update after the route commit.
      window.history.replaceState(
        { ...window.history.state, __bungae_navigation: { index: 1 } },
        "",
        destination,
      );
    },
  );
});
