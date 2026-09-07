import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

/**
 * Boundary surfaces must not import the auth provider, Motion, or PWA
 * islands: a failure inside those dependencies would leave recovery broken.
 * This test pins that by statically asserting the boundary modules never
 * reference those module paths.
 */
import RootError from "@/app/error";
import GlobalError from "@/app/global-error";
import NotFound from "@/app/not-found";

function moduleSource(modulePath: string): string {
  return readFileSync(join(process.cwd(), modulePath), "utf8");
}

describe("recovery boundary surfaces", () => {
  it("global-error, error, and not-found avoid auth/motion/pwa dependencies", () => {
    const boundaries = [
      "src/app/global-error.tsx",
      "src/app/error.tsx",
      "src/app/not-found.tsx",
      "src/app/meetups/error.tsx",
      "src/app/meetups/[meetupId]/error.tsx",
      "src/app/profile/error.tsx",
      "src/app/connections/error.tsx",
    ];
    const forbidden = [
      "auth-session-provider",
      "motion/react",
      "pwa-root",
      "AnimatedDialog",
    ];
    for (const boundary of boundaries) {
      const source = moduleSource(boundary);
      for (const dependency of forbidden) {
        expect(
          source.includes(dependency),
          `${boundary} must not depend on ${dependency}`,
        ).toBe(false);
      }
    }
  });

  it("renders recovery escapes from error and not-found surfaces", () => {
    render(<RootError error={new Error("boom")} reset={() => undefined} />);
    expect(
      screen.getByRole("heading", { name: "화면을 표시하지 못했어요" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈으로 돌아가기" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();

    render(<NotFound />);
    expect(
      screen.getByRole("heading", { name: "찾을 수 없는 화면이에요" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "벙개 홈으로" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "내 모임 보기" })).toHaveAttribute(
      "href",
      "/my-meetups",
    );
  });

  it("renders a self-contained global document without app dependencies", () => {
    const source = moduleSource("src/app/global-error.tsx");
    expect(source).toContain("<html lang=\"ko\">");

    render(<GlobalError error={new Error("root failure")} reset={() => undefined} />);
    expect(screen.getByRole("heading", { name: "화면을 표시하지 못했어요" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "홈으로 돌아가기" })).toHaveAttribute("href", "/");
  });
});
