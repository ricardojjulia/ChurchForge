import { render } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SessionTimeoutWrapper } from "@/components/application/session-timeout-wrapper";
import { signOutAction } from "@/app/sign-in/actions";

vi.mock("@/app/sign-in/actions", () => ({
  signOutAction: vi.fn(),
}));

describe("SessionTimeoutWrapper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(signOutAction).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render children", () => {
    const { getByText } = render(
      <SessionTimeoutWrapper>
        <div>Test Content</div>
      </SessionTimeoutWrapper>,
    );
    expect(getByText("Test Content")).toBeInTheDocument();
  });

  it("should log out after 15 minutes of inactivity", () => {
    render(
      <SessionTimeoutWrapper>
        <div>Test Content</div>
      </SessionTimeoutWrapper>,
    );

    expect(signOutAction).not.toHaveBeenCalled();

    // Advance 14 minutes
    vi.advanceTimersByTime(14 * 60 * 1000);
    expect(signOutAction).not.toHaveBeenCalled();

    // Advance 1 more minute (total 15 minutes)
    vi.advanceTimersByTime(1 * 60 * 1000);
    expect(signOutAction).toHaveBeenCalledWith(
      expect.stringContaining("Your%20session%20has%20expired%20due%20to%20inactivity."),
    );
  });

  it("should reset inactivity timer on user events", () => {
    render(
      <SessionTimeoutWrapper>
        <div>Test Content</div>
      </SessionTimeoutWrapper>,
    );

    // Advance 10 minutes
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(signOutAction).not.toHaveBeenCalled();

    // User moves mouse
    fireEvent.mouseMove(window);

    // Advance another 10 minutes (total 20 minutes elapsed, but only 10 since last activity)
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(signOutAction).not.toHaveBeenCalled();

    // Advance 6 more minutes (total 16 minutes since last activity)
    vi.advanceTimersByTime(6 * 60 * 1000);
    expect(signOutAction).toHaveBeenCalled();
  });

  it("should log out immediately on event if the actual time difference exceeds timeout", () => {
    const originalNow = Date.now;
    let mockNow = 1000000;
    Date.now = () => mockNow;

    try {
      render(
        <SessionTimeoutWrapper>
          <div>Test Content</div>
        </SessionTimeoutWrapper>,
      );

      expect(signOutAction).not.toHaveBeenCalled();

      // Simulate a gap in time (e.g. computer sleep) of 16 minutes without timers running
      mockNow += 16 * 60 * 1000;

      // Trigger user event which checks the date difference
      fireEvent.mouseMove(window);

      expect(signOutAction).toHaveBeenCalled();
    } finally {
      Date.now = originalNow;
    }
  });
});
