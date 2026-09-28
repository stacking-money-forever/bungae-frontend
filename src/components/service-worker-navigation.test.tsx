import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { ServiceWorkerNavigation, safeNavigationPath } from "./service-worker-navigation";

describe("ServiceWorkerNavigation", () => {
  const target = new EventTarget() as EventTarget & { startMessages: () => void };
  target.startMessages = vi.fn();

  beforeEach(() => {
    push.mockClear();
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: target });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  function post(data: unknown) {
    target.dispatchEvent(new MessageEvent("message", { data }));
  }

  it("routes a NAVIGATE message client-side, acknowledges it, and starts the message queue", () => {
    render(<ServiceWorkerNavigation />);
    expect(target.startMessages).toHaveBeenCalled();
    const ack = { postMessage: vi.fn() };
    post({ type: "NAVIGATE", url: "/meetups/m-1/chat?from=push#latest" });
    expect(push).toHaveBeenCalledWith("/meetups/m-1/chat?from=push#latest");
    const event = new MessageEvent("message", { data: { type: "NAVIGATE", url: "/profile" } });
    Object.defineProperty(event, "ports", { value: [ack] });
    target.dispatchEvent(event);
    expect(push).toHaveBeenLastCalledWith("/profile");
    expect(ack.postMessage).toHaveBeenCalledWith({ type: "NAVIGATED" });
  });

  it("ignores other messages and non-app destinations", () => {
    render(<ServiceWorkerNavigation />);
    post({ type: "SKIP_WAITING" });
    post({ type: "NAVIGATE", url: "https://attacker.example/" });
    post({ type: "NAVIGATE", url: "//attacker.example/" });
    post({ type: "NAVIGATE", url: "/\\attacker.example" });
    post("NAVIGATE");
    expect(push).not.toHaveBeenCalled();
  });

  it("stops listening after unmount", () => {
    const view = render(<ServiceWorkerNavigation />);
    view.unmount();
    post({ type: "NAVIGATE", url: "/my-meetups" });
    expect(push).not.toHaveBeenCalled();
  });

  it("accepts only same-origin app paths", () => {
    expect(safeNavigationPath("/profile")).toBe("/profile");
    expect(safeNavigationPath("profile")).toBeNull();
    expect(safeNavigationPath(42)).toBeNull();
  });
});
