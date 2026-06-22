"use client";

import { useEffect, useRef, useCallback } from "react";
import { signOut, useSession } from "next-auth/react";
import { toast } from "sonner";

const IDLE_TIMEOUT_MS   = 60 * 60 * 1000; // 1 jam
const WARNING_BEFORE_MS = 5  * 60 * 1000; // warning 5 menit sebelum timeout

/**
 * ActivityTracker — dipasang di dashboard layout.
 * Melacak aktivitas user (mouse, keyboard, scroll, touch).
 * Otomatis signOut jika idle >= 1 jam.
 * Warning muncul 5 menit sebelum timeout.
 */
export function ActivityTracker() {
  const { data: session } = useSession();
  const lastActivityRef  = useRef<number>(Date.now());
  const warningShownRef  = useRef<boolean>(false);
  const intervalRef      = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    warningShownRef.current = false;
  }, []);

  useEffect(() => {
    if (!session?.user) return;

    // Event yang dianggap sebagai "aktivitas"
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach(e => window.addEventListener(e, resetActivity, { passive: true }));

    // Cek idle setiap 1 menit
    intervalRef.current = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;

      // Warning 5 menit sebelum timeout
      if (idleMs >= IDLE_TIMEOUT_MS - WARNING_BEFORE_MS && !warningShownRef.current) {
        warningShownRef.current = true;
        toast.warning("Sesi akan berakhir dalam 5 menit karena tidak ada aktivitas.", {
          duration: 10000,
          id: "idle-warning",
        });
      }

      // Paksa logout jika idle >= 1 jam
      if (idleMs >= IDLE_TIMEOUT_MS) {
        clearInterval(intervalRef.current!);
        toast.dismiss("idle-warning");
        signOut({ callbackUrl: "/login?reason=idle" });
      }
    }, 60 * 1000); // cek setiap 1 menit

    return () => {
      events.forEach(e => window.removeEventListener(e, resetActivity));
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session?.user, resetActivity]);

  return null; // tidak render apapun
}
