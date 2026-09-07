import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ScreenLoading } from "./screen-loading";

describe("ScreenLoading", () => {
  afterEach(() => {
    document.querySelectorAll("[data-screen-loading-live]").forEach((node) => node.remove());
  });

  it("renders static geometry with a single polite live announcement", async () => {
    const { container } = render(<ScreenLoading variant="list" />);

    await act(async () => {
      await Promise.resolve();
    });

    const region = document.querySelector("[data-screen-loading-live]");
    expect(region).not.toBeNull();
    expect(region?.getAttribute("role")).toBe("status");
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(region?.textContent).toContain("화면을 불러오는 중이에요");

    expect(container.querySelector("[data-screen-loading]")).not.toBeNull();
    const decorativeRows = container.querySelectorAll("[aria-hidden='true'] .bg-\\[var\\(--bg-neutral-weak\\)\\]");
    expect(decorativeRows.length).toBeGreaterThan(0);
  });

  it("never invents headings, member counts, or result rows", async () => {
    render(<ScreenLoading variant="detail" />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByText(/모임 \d+개|서버|참여자/)).not.toBeInTheDocument();
  });
});
