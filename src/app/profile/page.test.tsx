import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProfilePage from "./page";

describe("ProfilePage", () => {
  it("updates the visible profile with local form state", async () => {
    render(<ProfilePage />);

    fireEvent.click(screen.getByRole("button", { name: "표시 프로필 수정" }));
    fireEvent.change(screen.getByLabelText("표시 이름"), {
      target: { value: "서연" },
    });
    fireEvent.change(screen.getByLabelText("활동 지역"), {
      target: { value: "마포구 연남동" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장하기" }));

    expect(screen.getByRole("heading", { name: /서연/ })).toBeInTheDocument();
    expect(screen.getByText("마포구 연남동")).toBeInTheDocument();
    expect(screen.getByText(/20대 · 마포구 연남동/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByLabelText("표시 이름")).not.toBeInTheDocument(),
    );
  });

  it("requires confirmation before logging out", async () => {
    render(<ProfilePage />);

    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(screen.getByRole("dialog", { name: "로그아웃할까요?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
  });

  it("commits logout after the confirmation has exited", async () => {
    render(<ProfilePage />);

    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    fireEvent.click(screen.getByRole("button", { name: /^로그아웃$/ }));

    expect(
      screen.queryByRole("button", { name: "로그아웃 완료", hidden: true }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "로그아웃 완료", hidden: true }),
      ).toBeInTheDocument();
    });
  });
});
