"use client";

import { useEffect, useRef } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";

const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];

export function useInactivityLogout(timeoutMs: number = TIMEOUT_MS) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => signOut(auth), timeoutMs);
    }

    reset();
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, reset));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, reset));
    };
  }, [timeoutMs]);
}
