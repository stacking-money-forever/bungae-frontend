import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import Link from "next/link";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getIncomingVariants,
  getNavigationIntent,
  PageTransition,
  setNavigationIntent,
} from "./page-transition";
import { NavigationLink } from "./navigation-link";

const usePathname = vi.fn();
const useSearchParams = vi.fn();
const routerPush = vi.fn();
const routerBack = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
  useSearchParams: () => useSearchParams(),
  useRouter: () => ({ push: routerPush, back: routerBack }),
}));

describe("PageTransition", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/test");
    routerPush.mockReset();
    routerBack.mockReset();
    useSearchParams.mockImplementation(() => new URLSearchParams(window.location.search));
    window.history.replaceState({}, "", "/test");
  });

  it("uses pop for history back and push for history forward", async () => {
    const { container, rerender } = render(
      <PageTransition>
        <p>홈</p>
      </PageTransition>,
    );

    await waitFor(() => {
      expect(container.querySelector(".route-transition"))
        .toHaveAttribute("data-navigation-intent", "push");
    });

    window.history.replaceState(
      { __bungae_navigation: { index: 1 } },
      "",
      "/meetups/demo",
    );
    usePathname.mockReturnValue("/meetups/demo");
    rerender(
      <PageTransition>
        <p>상세</p>
      </PageTransition>,
    );

    await waitFor(() => {
      expect(container.querySelector(".route-transition"))
        .toHaveAttribute("data-navigation-intent", "push");
    });

    const backState = { __bungae_navigation: { index: 0 } };
    window.history.replaceState(backState, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate", { state: backState }));
    usePathname.mockReturnValue("/");
    rerender(
      <PageTransition>
        <p>홈</p>
      </PageTransition>,
    );

    await waitFor(() => {
      expect(container.querySelector(".route-transition"))
        .toHaveAttribute("data-navigation-intent", "pop");
    });

    const forwardState = { __bungae_navigation: { index: 1 } };
    window.history.replaceState(forwardState, "", "/meetups/demo");
    window.dispatchEvent(new PopStateEvent("popstate", { state: forwardState }));
    usePathname.mockReturnValue("/meetups/demo");
    rerender(
      <PageTransition>
        <p>상세</p>
      </PageTransition>,
    );

    await waitFor(() => {
      expect(container.querySelector(".route-transition"))
        .toHaveAttribute("data-navigation-intent", "push");
    });
  });

  it("counts visual pop links as pushed entries before browser back/forward", async () => {
    const readIndex = () => window.history.state?.__bungae_navigation?.index;
    const { container, rerender } = render(
      <PageTransition>
        <Link href="/meetups/demo" onClick={(event) => event.preventDefault()}>
          상세로 이동
        </Link>
      </PageTransition>,
    );

    await waitFor(() => expect(readIndex()).toBe(0));

    fireEvent.click(screen.getByRole("link", { name: "상세로 이동" }));
    window.history.pushState({}, "", "/meetups/demo");
    usePathname.mockReturnValue("/meetups/demo");
    rerender(
      <PageTransition>
        <Link href="/" aria-label="뒤로가기" onClick={(event) => event.preventDefault()}>
          홈으로
        </Link>
      </PageTransition>,
    );

    await waitFor(() => {
      expect(readIndex()).toBe(1);
      expect(container.querySelector(".route-transition")).toHaveAttribute(
        "data-navigation-intent",
        "push",
      );
    });

    fireEvent.click(screen.getByRole("link", { name: "뒤로가기" }));
    window.history.pushState({}, "", "/");
    usePathname.mockReturnValue("/");
    rerender(
      <PageTransition>
        <Link href="/meetups/demo" onClick={(event) => event.preventDefault()}>
          상세로 이동
        </Link>
      </PageTransition>,
    );

    await waitFor(() => expect(readIndex()).toBe(2));

    await new Promise<void>((resolve) => {
      window.addEventListener("popstate", () => resolve(), { once: true });
      window.history.back();
    });
    usePathname.mockReturnValue("/meetups/demo");
    rerender(
      <PageTransition>
        <p>상세</p>
      </PageTransition>,
    );

    await waitFor(() => {
      expect(readIndex()).toBe(1);
      expect(container.querySelector(".route-transition")).toHaveAttribute(
        "data-navigation-intent",
        "pop",
      );
    });

    await new Promise<void>((resolve) => {
      window.addEventListener("popstate", () => resolve(), { once: true });
      window.history.forward();
    });
    usePathname.mockReturnValue("/");
    rerender(
      <PageTransition>
        <p>홈</p>
      </PageTransition>,
    );

    await waitFor(() => {
      expect(readIndex()).toBe(2);
      expect(container.querySelector(".route-transition")).toHaveAttribute(
        "data-navigation-intent",
        "push",
      );
    });
  });

  it("preserves browser history indices when Next publishes the route before popstate bookkeeping", async () => {
    const readIndex = () => window.history.state?.__bungae_navigation?.index;
    let updateRoute: (ui: React.ReactNode) => void = () => undefined;

    // Next's router listener is registered before PageTransition's listener in
    // the browser. It can publish the pathname and render the destination
    // before PageTransition receives the same popstate event.
    const nextRouterPop = () => {
      const destination = window.location.pathname;
      // Simulate Next's history updater replacing the active entry before the
      // route tree finishes rendering. Its state does not carry our custom
      // index, so PageTransition must use the popstate payload it captured.
      window.history.replaceState({ __NA: true }, "", window.location.href);
      usePathname.mockReturnValue(destination);
      updateRoute(
        <PageTransition>
          <p>{destination === "/" ? "홈" : "상세"}</p>
        </PageTransition>,
      );
    };
    window.addEventListener("popstate", nextRouterPop);

    const view = render(
      <PageTransition>
        <p>홈</p>
      </PageTransition>,
    );
    updateRoute = view.rerender;

    await waitFor(() => expect(readIndex()).toBe(0));

    window.history.pushState({}, "", "/meetups/demo");
    usePathname.mockReturnValue("/meetups/demo");
    view.rerender(
      <PageTransition>
        <Link href="/" aria-label="뒤로가기" onClick={(event) => event.preventDefault()}>
          홈으로
        </Link>
      </PageTransition>,
    );
    await waitFor(() => expect(readIndex()).toBe(1));

    fireEvent.click(screen.getByRole("link", { name: "뒤로가기" }));
    window.history.pushState({}, "", "/");
    usePathname.mockReturnValue("/");
    view.rerender(
      <PageTransition>
        <Link href="/meetups/demo">상세로 이동</Link>
      </PageTransition>,
    );
    await waitFor(() => expect(readIndex()).toBe(2));

    const waitForPopState = () =>
      new Promise<void>((resolve) => {
        window.addEventListener("popstate", () => resolve(), { once: true });
      });

    const back = waitForPopState();
    window.history.back();
    await back;
    await waitFor(() => {
      expect(readIndex()).toBe(1);
      expect(view.container.querySelector(".route-transition")).toHaveAttribute(
        "data-navigation-intent",
        "pop",
      );
    });

    const forward = waitForPopState();
    window.history.forward();
    await forward;
    await waitFor(() => {
      expect(readIndex()).toBe(2);
      expect(view.container.querySelector(".route-transition")).toHaveAttribute(
        "data-navigation-intent",
        "push",
      );
    });

    window.removeEventListener("popstate", nextRouterPop);
  });

  it("infers traversal from the live target index when Next renders before PageTransition sees popstate", async () => {
    const readIndex = () => window.history.state?.__bungae_navigation?.index;
    let updateRoute: (ui: React.ReactNode) => void = () => undefined;

    // In the browser, Next can run its popstate handler before a later
    // listener, update the route tree, and preserve the target entry's state.
    // PageTransition must be able to classify that render without depending
    // on winning listener registration order.
    const nextRouterPop = () => {
      const destination = window.location.pathname;
      const currentState = window.history.state;
      if (currentState && typeof currentState === "object") {
        window.history.replaceState(
          { ...(currentState as Record<string, unknown>), __NA: true },
          "",
          window.location.href,
        );
      }
      usePathname.mockReturnValue(destination);
      updateRoute(
        <PageTransition>
          <p>{destination === "/" ? "홈" : "상세"}</p>
        </PageTransition>,
      );
    };
    window.addEventListener("popstate", nextRouterPop, true);

    try {
      const view = render(
        <PageTransition>
          <p>홈</p>
        </PageTransition>,
      );
      updateRoute = view.rerender;

      await waitFor(() => expect(readIndex()).toBe(0));

      window.history.pushState({}, "", "/meetups/demo");
      usePathname.mockReturnValue("/meetups/demo");
      view.rerender(
        <PageTransition>
          <Link href="/" aria-label="뒤로가기" onClick={(event) => event.preventDefault()}>
            홈으로
          </Link>
        </PageTransition>,
      );
      await waitFor(() => expect(readIndex()).toBe(1));

      fireEvent.click(screen.getByRole("link", { name: "뒤로가기" }));
      window.history.pushState({}, "", "/");
      usePathname.mockReturnValue("/");
      view.rerender(
        <PageTransition>
          <Link href="/meetups/demo">상세로 이동</Link>
        </PageTransition>,
      );
      await waitFor(() => expect(readIndex()).toBe(2));

      window.history.back();
      await waitFor(() => {
        expect(readIndex()).toBe(1);
        expect(window.history.state?.__NA).toBe(true);
        expect(view.container.querySelector(".route-transition")).toHaveAttribute(
          "data-navigation-intent",
          "pop",
        );
      });

      window.history.forward();
      await waitFor(() => {
        expect(readIndex()).toBe(2);
        expect(window.history.state?.__NA).toBe(true);
        expect(view.container.querySelector(".route-transition")).toHaveAttribute(
          "data-navigation-intent",
          "push",
        );
      });
    } finally {
      window.removeEventListener("popstate", nextRouterPop, true);
    }
  });

  it("treats search changes as route entries but leaves hash-only anchors to the browser", async () => {
    const readIndex = () => window.history.state?.__bungae_navigation?.index;
    const { container, rerender } = render(
      <PageTransition>
        <Link href="/meetups/new?posted=1" onClick={(event) => event.preventDefault()}>
          게시 완료
        </Link>
      </PageTransition>,
    );

    await waitFor(() => expect(readIndex()).toBe(0));

    fireEvent.click(screen.getByRole("link", { name: "게시 완료" }));
    window.history.pushState({}, "", "/meetups/new?posted=1");
    usePathname.mockReturnValue("/meetups/new");
    rerender(
      <PageTransition>
        <p>게시 완료 화면</p>
      </PageTransition>,
    );

    await waitFor(() => {
      expect(readIndex()).toBe(1);
      expect(container.querySelector(".route-transition")).toHaveAttribute(
        "data-navigation-intent",
        "push",
      );
    });

    window.history.replaceState(
      { __bungae_navigation: { index: 1 } },
      "",
      "/meetups/new?posted=1",
    );
    usePathname.mockReturnValue("/meetups/new");
    rerender(
      <PageTransition>
        <Link
          href="/meetups/new?posted=1#title"
          onClick={(event) => event.preventDefault()}
        >
          같은 화면 앵커
        </Link>
      </PageTransition>,
    );
    await waitFor(() => expect(readIndex()).toBe(1));

    fireEvent.click(screen.getByRole("link", { name: "같은 화면 앵커" }));
    expect(readIndex()).toBe(1);
  });

  it("normalizes encoded and raw search values without creating a false route transition", async () => {
    window.history.replaceState({}, "", "/meetups/new?q=a%20b");
    usePathname.mockReturnValue("/meetups/new");
    const { container, rerender } = render(
      <PageTransition>
        <p>검색 결과</p>
      </PageTransition>,
    );

    await waitFor(() => {
      expect(window.history.state?.__bungae_navigation?.index).toBe(0);
    });

    window.history.pushState({}, "", "/meetups/new?q=a+b");
    rerender(
      <PageTransition>
        <p>동일한 검색 결과</p>
      </PageTransition>,
    );

    await waitFor(() => {
      expect(window.history.state?.__bungae_navigation?.index).toBe(0);
      expect(container.querySelectorAll(".route-transition")).toHaveLength(1);
    });
  });

  it("does not retain a programmatic intent when the route stays unchanged", async () => {
    const { container, rerender } = render(
      <PageTransition>
        <p>홈</p>
      </PageTransition>,
    );

    await waitFor(() => expect(window.history.state?.__bungae_navigation?.index).toBe(0));

    setNavigationIntent("sheet");
    rerender(
      <PageTransition>
        <p>홈 갱신</p>
      </PageTransition>,
    );

    window.history.pushState({}, "", "/meetups/demo");
    usePathname.mockReturnValue("/meetups/demo");
    rerender(
      <PageTransition>
        <p>상세</p>
      </PageTransition>,
    );

    await waitFor(() => {
      expect(container.querySelector(".route-transition")).toHaveAttribute(
        "data-navigation-intent",
        "push",
      );
    });
  });

  it("clears stale intent when a same-destination link is prevented", async () => {
    const { container, rerender } = render(
      <PageTransition>
        <Link href="/" onClick={(event) => event.preventDefault()}>
          홈 유지
        </Link>
      </PageTransition>,
    );

    await waitFor(() => expect(window.history.state?.__bungae_navigation?.index).toBe(0));
    setNavigationIntent("sheet");
    fireEvent.click(screen.getByRole("link", { name: "홈 유지" }));

    window.history.pushState({}, "", "/meetups/demo");
    usePathname.mockReturnValue("/meetups/demo");
    rerender(
      <PageTransition>
        <p>상세</p>
      </PageTransition>,
    );

    await waitFor(() => {
      expect(container.querySelector(".route-transition")).toHaveAttribute(
        "data-navigation-intent",
        "push",
      );
    });
  });

  it("keeps hash entries native across actual back and forward events", async () => {
    usePathname.mockReturnValue("/");
    window.history.replaceState({}, "", "/");
    const { container, rerender } = render(
      <PageTransition>
        <p>홈</p>
      </PageTransition>,
    );

    await waitFor(() => expect(window.history.state?.__bungae_navigation?.index).toBe(0));

    window.history.pushState(window.history.state, "", "/#title");
    await new Promise<void>((resolve) => {
      window.addEventListener("popstate", () => resolve(), { once: true });
      window.history.back();
    });
    expect(window.location.hash).toBe("");
    expect(window.history.state?.__bungae_navigation?.index).toBe(0);
    expect(container.querySelector(".route-transition")).toHaveAttribute(
      "data-navigation-intent",
      "push",
    );

    await new Promise<void>((resolve) => {
      window.addEventListener("popstate", () => resolve(), { once: true });
      window.history.forward();
    });
    expect(window.location.hash).toBe("#title");
    expect(window.history.state?.__bungae_navigation?.index).toBe(0);
    expect(container.querySelector(".route-transition")).toHaveAttribute(
      "data-navigation-intent",
      "push",
    );

    const detailState = { __bungae_navigation: { index: 1 } };
    window.history.pushState(detailState, "", "/meetups/demo");
    usePathname.mockReturnValue("/meetups/demo");
    rerender(
      <PageTransition>
        <p>상세</p>
      </PageTransition>,
    );
    await waitFor(() => expect(window.history.state?.__bungae_navigation?.index).toBe(1));

    await new Promise<void>((resolve) => {
      window.addEventListener("popstate", () => resolve(), { once: true });
      window.history.back();
    });
    usePathname.mockReturnValue("/");
    rerender(
      <PageTransition>
        <p>홈</p>
      </PageTransition>,
    );
    await waitFor(() => {
      expect(container.querySelector(".route-transition")).toHaveAttribute(
        "data-navigation-intent",
        "pop",
      );
    });
  });

  it("does not retain an intent when a link click is prevented", async () => {
    const { container, rerender } = render(
      <PageTransition>
        <Link
          href="/filters"
          data-transition="sheet"
          onClick={(event) => event.preventDefault()}
        >
          필터 열기
        </Link>
      </PageTransition>,
    );

    fireEvent.click(screen.getByRole("link", { name: "필터 열기" }));

    window.history.replaceState({}, "", "/meetups/demo");
    usePathname.mockReturnValue("/meetups/demo");
    rerender(
      <PageTransition>
        <p>상세</p>
      </PageTransition>,
    );

    await waitFor(() => {
      expect(container.querySelector(".route-transition"))
        .toHaveAttribute("data-navigation-intent", "push");
    });
  });

  it("does not capture a prevented managed link before a later filters navigation", async () => {
    const { container, rerender } = render(
      <PageTransition>
        <NavigationLink
          href="/filters"
          navigationIntent="sheet"
          onClick={(event) => event.preventDefault()}
        >
          필터 열기
        </NavigationLink>
      </PageTransition>,
    );

    await waitFor(() => expect(window.history.state?.__bungae_navigation?.index).toBe(0));

    fireEvent.click(screen.getByRole("link", { name: "필터 열기" }));

    window.history.pushState({}, "", "/filters");
    usePathname.mockReturnValue("/filters");
    rerender(
      <PageTransition>
        <p>필터 화면</p>
      </PageTransition>,
    );

    await waitFor(() => {
      expect(container.querySelector(".route-transition")).toHaveAttribute(
        "data-navigation-intent",
        "push",
      );
      expect(window.history.state?.__bungae_navigation?.index).toBe(1);
    });
  });

  it("renders one route transition surface for the destination", () => {
    const { container, rerender } = render(
      <PageTransition>
        <p>현재 화면</p>
      </PageTransition>,
    );

    expect(container.querySelectorAll(".route-transition")).toHaveLength(1);
    expect(screen.getByText("현재 화면")).toBeInTheDocument();

    usePathname.mockReturnValue("/meetups/demo");
    rerender(
      <PageTransition>
        <p>상세 화면</p>
      </PageTransition>,
    );

    expect(container.querySelectorAll(".route-transition")).toHaveLength(1);
    expect(screen.getByText("상세 화면")).toBeInTheDocument();
  });

  it("does not retain the previous route DOM after a navigation", () => {
    const { container, rerender } = render(
      <PageTransition>
        <p>현재 홈</p>
      </PageTransition>,
    );
    expect(screen.getByText("현재 홈")).toBeInTheDocument();

    usePathname.mockReturnValue("/meetups/demo");
    window.history.pushState({}, "", "/meetups/demo");
    rerender(
      <PageTransition>
        <p>상세 화면</p>
      </PageTransition>,
    );

    expect(screen.getByText("상세 화면")).toBeInTheDocument();
    expect(container.querySelector(".route-history-underlay")).not.toBeInTheDocument();
    expect(container.querySelector(".root-tab-panel")).not.toBeInTheDocument();
    expect(screen.queryByText("현재 홈")).not.toBeInTheDocument();
  });

  it("commits a tab gesture to the destination route", async () => {
    usePathname.mockReturnValue("/");
    window.history.replaceState({}, "", "/");
    render(
      <PageTransition>
        <p>홈 화면</p>
      </PageTransition>,
    );

    window.dispatchEvent(
      new CustomEvent("bungae:tab-gesture", {
        detail: { phase: "commit", direction: -1, target: "/my-meetups" },
      }),
    );

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith("/my-meetups");
    });
  });

  it("ignores non-committing tab gesture updates and cancels", () => {
    render(
      <PageTransition>
        <p>홈 화면</p>
      </PageTransition>,
    );

    window.dispatchEvent(
      new CustomEvent("bungae:tab-gesture", {
        detail: { phase: "update", x: 120 },
      }),
    );
    window.dispatchEvent(new CustomEvent("bungae:tab-gesture", { detail: { phase: "cancel" } }));

    expect(routerPush).not.toHaveBeenCalled();
  });

  it("does not cache portal-backed sheet routes as swipe underlays", () => {
    usePathname.mockReturnValue("/locations");
    window.history.replaceState({}, "", "/locations");
    const { container, rerender } = render(
      <PageTransition>
        <p>위치 시트</p>
      </PageTransition>,
    );

    usePathname.mockReturnValue("/meetups/demo");
    window.history.pushState({}, "", "/meetups/demo");
    rerender(
      <PageTransition>
        <p>상세 화면</p>
      </PageTransition>,
    );

    expect(container.querySelector(".route-history-underlay")).not.toBeInTheDocument();
  });

  it("navigates back after a committed right swipe on a pushed route", async () => {
    const { container, rerender } = render(
      <PageTransition>
        <p>홈 화면</p>
      </PageTransition>,
    );

    usePathname.mockReturnValue("/meetups/demo");
    window.history.pushState({}, "", "/meetups/demo");
    rerender(
      <PageTransition>
        <p>상세 화면</p>
      </PageTransition>,
    );
    const surface = container.querySelector(".route-gesture-surface");
    expect(surface).not.toBeNull();

    fireEvent.pointerDown(surface!, { pointerId: 7, button: 0, isPrimary: true, clientX: 40, clientY: 120 });
    fireEvent.pointerMove(surface!, { pointerId: 7, isPrimary: true, clientX: 170, clientY: 125 });
    fireEvent.pointerUp(surface!, { pointerId: 7, button: 0, isPrimary: true, clientX: 170, clientY: 125 });

    await waitFor(() => expect(routerBack).toHaveBeenCalledTimes(1));
  });

  it("does not navigate back when an in-progress page swipe is cancelled", async () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = render(
        <PageTransition>
          <p>홈 화면</p>
        </PageTransition>,
      );

      usePathname.mockReturnValue("/meetups/demo");
      window.history.pushState({}, "", "/meetups/demo");
      rerender(
        <PageTransition>
          <p>상세 화면</p>
        </PageTransition>,
      );
      const surface = container.querySelector(".route-gesture-surface");

      fireEvent.pointerDown(surface!, { pointerId: 9, button: 0, isPrimary: true, clientX: 40, clientY: 120 });
      fireEvent.pointerMove(window, { pointerId: 9, isPrimary: true, clientX: 170, clientY: 125 });
      fireEvent.pointerCancel(window, { pointerId: 9, isPrimary: true, clientX: 170, clientY: 125 });

      await vi.advanceTimersByTimeAsync(240);
      expect(routerBack).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not start an interactive back swipe without a rendered previous route", () => {
    usePathname.mockReturnValue("/meetups/demo");
    window.history.replaceState({}, "", "/meetups/demo");
    const { container } = render(
      <PageTransition>
        <p>직접 진입 상세</p>
      </PageTransition>,
    );
    const surface = container.querySelector(".route-gesture-surface--foreground");

    fireEvent.pointerDown(surface!, { pointerId: 8, button: 0, isPrimary: true, clientX: 40, clientY: 120 });
    fireEvent.pointerMove(window, { pointerId: 8, isPrimary: true, clientX: 180, clientY: 125 });
    fireEvent.pointerUp(window, { pointerId: 8, button: 0, isPrimary: true, clientX: 180, clientY: 125 });

    expect(routerBack).not.toHaveBeenCalled();
  });

  it("resolves intents from internal anchor semantics", () => {
    render(
      <div>
        <nav className="bottom-navigation">
          <Link href="/my-meetups">내 모임</Link>
        </nav>
        <a href="https://example.com">외부</a>
      </div>,
    );

    expect(getNavigationIntent(screen.getByRole("link", { name: "내 모임" }))).toBe("tab");
    expect(getNavigationIntent(screen.getByRole("link", { name: "외부" }))).toBeNull();
  });

  it("uses zero-duration route motion when reduced motion is requested", () => {
    const variants = getIncomingVariants(true);

    expect(variants.animate("push").transition.duration).toBe(0);
    expect(variants.animate("tab").transition.duration).toBe(0);
    expect(variants.initial("push")).toEqual({ opacity: 1, x: 0 });
  });

  it("uses pop for back links and preserves explicit transition values", () => {
    render(
      <div>
        <Link href="/" aria-label="뒤로가기">
          뒤로가기
        </Link>
        <Link href="/filters" data-transition="sheet">
          시트 열기
        </Link>
        <Link href="/meetups/demo" data-transition="replace">
          교체
        </Link>
        <Link href="/meetups/demo" data-transition="pop">
          팝
        </Link>
        <Link href="/meetups/demo">상세</Link>
      </div>,
    );

    expect(getNavigationIntent(screen.getByRole("link", { name: "뒤로가기" }))).toBe("pop");
    expect(getNavigationIntent(screen.getByRole("link", { name: "시트 열기" }))).toBe("sheet");
    expect(getNavigationIntent(screen.getByRole("link", { name: "교체" }))).toBe("replace");
    expect(getNavigationIntent(screen.getByRole("link", { name: "팝" }))).toBe("pop");
    expect(getNavigationIntent(screen.getByRole("link", { name: "상세" }))).toBe("push");
  });
});
