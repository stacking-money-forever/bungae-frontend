import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BlocksPage from "./page";

describe("BlocksPage", () => {
  it("closes the confirmation before removing the row and restores focus to the next action", async () => {
    render(<BlocksPage />);

    fireEvent.click(screen.getByRole("button", { name: "지민님 차단 해제" }));
    expect(screen.getByRole("dialog", { name: "차단을 해제할까요?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^차단 해제$/ }));

    expect(
      screen.getByRole("button", { name: "지민님 차단 해제", hidden: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "차단을 해제할까요?" })).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "차단한 사람 1명", hidden: true }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "서연님 차단 해제", hidden: true }),
    ).toHaveFocus();
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent(
      "지민님 차단을 해제했어요.",
    );
  });

  it("keeps the blocked person and restores its trigger when confirmation is cancelled", async () => {
    render(<BlocksPage />);

    const unblockJiminButton = screen.getByRole("button", { name: "지민님 차단 해제" });
    fireEvent.click(unblockJiminButton);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "차단한 사람 2명" })).toBeInTheDocument();
      expect(unblockJiminButton).toHaveFocus();
    });
  });

  it("focuses the count title after the final blocked person is removed", async () => {
    render(<BlocksPage />);

    fireEvent.click(screen.getByRole("button", { name: "지민님 차단 해제" }));
    fireEvent.click(screen.getByRole("button", { name: /^차단 해제$/ }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "차단한 사람 1명" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "서연님 차단 해제" }));
    fireEvent.click(screen.getByRole("button", { name: /^차단 해제$/ }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "차단한 사람 0명" })).toHaveFocus();
      expect(screen.getByRole("status")).toHaveTextContent("차단한 사람이 없어요.");
    });
  });
});
