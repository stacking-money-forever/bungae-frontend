import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ConnectionsPage from "./page";

describe("ConnectionsPage", () => {
  it("closes the confirmation before removing the row and restores focus to the next action", async () => {
    render(<ConnectionsPage />);

    const endMinjiButton = screen.getByRole("button", { name: "민지님과 연결 종료" });
    fireEvent.click(endMinjiButton);

    expect(screen.getByRole("dialog", { name: "연결을 종료할까요?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^연결 종료$/ }));

    expect(
      screen.getByRole("button", { name: "민지님과 연결 종료", hidden: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "연결을 종료할까요?" })).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "연결된 사람 1명", hidden: true }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "도윤님과 연결 종료", hidden: true }),
    ).toHaveFocus();
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent(
      "민지님과의 연결을 종료했어요.",
    );
  });

  it("keeps the connection and restores its trigger when confirmation is cancelled", async () => {
    render(<ConnectionsPage />);

    const endMinjiButton = screen.getByRole("button", { name: "민지님과 연결 종료" });
    fireEvent.click(endMinjiButton);
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "연결된 사람 2명" })).toBeInTheDocument();
      expect(endMinjiButton).toHaveFocus();
    });
  });

  it("focuses the count title after the final connection is removed", async () => {
    render(<ConnectionsPage />);

    fireEvent.click(screen.getByRole("button", { name: "민지님과 연결 종료" }));
    fireEvent.click(screen.getByRole("button", { name: /^연결 종료$/ }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "연결된 사람 1명" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "도윤님과 연결 종료" }));
    fireEvent.click(screen.getByRole("button", { name: /^연결 종료$/ }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "연결된 사람 0명" })).toHaveFocus();
      expect(screen.getByRole("status")).toHaveTextContent("아직 연결된 사람이 없어요.");
    });
  });
});
