// Layout wrapper for all /donor/* routes: mobile-first max-w-md container
// with the red/white medical theme background. Also registers the PWA
// service worker + manifest link (Tier 3 PWA bonus) so donors can "Add to
// Home Screen" and keep receiving local Notifications while backgrounded.
// Feature: Donor UI (Person 3).
"use client";

import { useEffect } from "react";

export default function DonorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => console.warn("[pwa] service worker registration failed:", err));
    }
  }, []);

  return <div className="min-h-screen bg-raksha-50">{children}</div>;
}
