import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BottomActionBar } from "./bottom-action-bar";
import { ScreenShell } from "./screen-shell";
import { TopNavigation } from "./top-navigation";

describe("shared app chrome", () => {
  it("uses the shared sticky header and elevated bottom action surfaces", () => {
    const { container } = render(
      <ScreenShell bottomSpacing>
        <TopNavigation href="/" title="상세" />
        <p>내용</p>
        <BottomActionBar>
          <button type="button">계속</button>
        </BottomActionBar>
      </ScreenShell>,
    );

    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelector(".top-navigation")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo", { name: "화면 주요 행동" })).toHaveClass(
      "bottom-action-bar",
    );
    expect(container.firstElementChild).toHaveClass("overflow-x-clip");
  });

  it("keeps flat sticky headers and elevated bottom chrome in the shared stylesheet", () => {
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const stickyHeaderRule = css.match(/\.top-navigation,[\s\S]*?\n\}/)?.[0] ?? "";
    expect(stickyHeaderRule).toContain("position: sticky");
    expect(stickyHeaderRule).not.toContain("border-bottom");
    expect(stickyHeaderRule).not.toContain("box-shadow");
    expect(css).toMatch(/\.bottom-action-bar \{[\s\S]*box-shadow/);
    expect(css).toMatch(/--occupied-bottom:/);
    expect(css).toMatch(/\.create-fab \{[\s\S]*bottom: var\(--occupied-bottom\)/);
    expect(css).toMatch(/\.meetup-feed \{[\s\S]*var\(--occupied-bottom\)/);
    expect(css).toMatch(/--tab-bar-occupied-height:/);
    expect(css).toMatch(/min-height: calc\(64px \+ var\(--safe-area-top\)\)/);
    expect(css).toMatch(/\.route-gesture-surface--foreground \{[\s\S]*width: min\(100%, var\(--screen-product-width\)\)/);
  });
});
