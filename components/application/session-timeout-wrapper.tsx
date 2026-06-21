"use client";

import { useEffect } from "react";
import { signOutAction } from "@/app/sign-in/actions";

type Props = {
  children: React.ReactNode;
};

export function SessionTimeoutWrapper({ children }: Props) {
  useEffect(() => {
    const TIMEOUT_DURATION = 15 * 60 * 1000; // 15 minutes
    const events = ["mousemove", "keydown", "scroll", "click", "touchstart"];

    let lastActive = Date.now();
    let timeoutId = setTimeout(handleLogout, TIMEOUT_DURATION);

    function handleLogout() {
      clearTimeout(timeoutId);
      const message = "Your session has expired due to inactivity.";
      signOutAction(`/sign-in?message=${encodeURIComponent(message)}`);
    }

    const resetTimer = () => {
      const now = Date.now();

      // Check if the difference since last active is already greater than timeout duration.
      // This handles computer sleep or tab suspension where setTimeout didn't fire.
      if (now - lastActive >= TIMEOUT_DURATION) {
        handleLogout();
        return;
      }

      lastActive = now;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleLogout, TIMEOUT_DURATION);
    };

    // Attach listeners
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    // Cleanup listeners and timeout on unmount
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
      clearTimeout(timeoutId);
    };
  }, []);

  return <>{children}</>;
}
