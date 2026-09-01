import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProfilePage from "./page";

describe("ProfilePage", () => {
  it("updates the visible profile with local form state", () => {
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
    expect(screen.queryByLabelText("표시 이름")).not.toBeInTheDocument();
  });

  it("requires confirmation before logging out", () => {
    render(<ProfilePage />);

    fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(screen.getByRole("alertdialog", { name: "로그아웃할까요?" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
  });
});
