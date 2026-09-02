import { describe, expect, it } from "vitest";

import {
  getAdjacentTabDestination,
  getGestureAxis,
  isRootTabPath,
  isSwipeGestureBlockedTarget,
  shouldCommitHorizontalGesture,
} from "./navigation-gestures";

describe("navigation gestures", () => {
  it("locks to the dominant axis after the dead zone", () => {
    expect(getGestureAxis(4, 3)).toBe("pending");
    expect(getGestureAxis(24, 5)).toBe("horizontal");
    expect(getGestureAxis(6, 24)).toBe("vertical");
  });

  it("commits by distance or velocity", () => {
    expect(shouldCommitHorizontalGesture(100, 500)).toBe(true);
    expect(shouldCommitHorizontalGesture(40, 40)).toBe(true);
    expect(shouldCommitHorizontalGesture(40, 500)).toBe(false);
  });

  it("selects only an adjacent root tab", () => {
    expect(getAdjacentTabDestination("/", -120)).toBe("/my-meetups");
    expect(getAdjacentTabDestination("/my-meetups", 120)).toBe("/");
    expect(getAdjacentTabDestination("/notifications", -120)).toBeNull();
    expect(getAdjacentTabDestination("/meetups/demo", -120)).toBeNull();
    expect(isRootTabPath("/notifications")).toBe(true);
    expect(isRootTabPath("/meetups/demo")).toBe(false);
  });

  it("does not start page swipes from interactive controls", () => {
    const button = document.createElement("button");
    const text = document.createElement("span");
    button.append(text);
    expect(isSwipeGestureBlockedTarget(text)).toBe(true);
    expect(isSwipeGestureBlockedTarget(document.body)).toBe(false);
  });
});
