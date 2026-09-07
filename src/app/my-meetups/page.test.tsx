import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MyMeetupsPage from "./page";

describe("MyMeetupsPage", () => {
  it("renders the root without unauthenticated fixture content", () => {
    render(<MyMeetupsPage />);

    expect(screen.getByRole("heading", { name: "내 모임" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "뒤로가기" })).not.toBeInTheDocument();
    expect(screen.getByText("로그인한 뒤 내 모임을 확인해 주세요.")).toBeInTheDocument();
  });
});
