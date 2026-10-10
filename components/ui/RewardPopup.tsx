// Generic "new badge earned" celebration popup: confetti burst + badge card,
// auto-dismiss or tap-to-close. Shared UI (Person 3) - caller decides *when*
// to show it (e.g. donor profile page diffing badge ids against localStorage).
"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

export interface RewardPopupProps {
  open: boolean;
  onClose: () => void;
  emoji?: string;
  title: string;
  subtitle?: string;
  /** Auto-close after this many ms (0 disables auto-close). Default 4000. */
  autoCloseMs?: number;
}

const CONFETTI_COLORS = [
  "#bc1414",
  "#f33a3a",
  "#fd6565",
  "#ffc5c5",
  "#15803d",
  "#f5c518",
];

/** Deterministic-enough confetti piece positions/delays (no external lib). */
const CONFETTI_PIECES = Array.from({ length: 24 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 8) * 0.08,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  rotate: (i * 53) % 360,
}));

/** Badge/confetti popup - fires when the caller detects a newly-earned badge. */
export function RewardPopup({
  open,
  onClose,
  emoji = "🏅",
  title,
  subtitle,
  autoCloseMs = 4000,
}: RewardPopupProps) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      if (autoCloseMs > 0) {
        const t = setTimeout(onClose, autoCloseMs);
        return () => clearTimeout(t);
      }
    }
  }, [open, autoCloseMs, onClose]);

  if (!mounted || !open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
      role="dialog"
      aria-live="assertive"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {CONFETTI_PIECES.map((p, i) => (
          <span
            key={i}
            className="absolute top-0 h-2 w-2 animate-[reward-confetti-fall_1.6s_ease-in_forwards]"
            style={{
              left: `${p.left}%`,
              backgroundColor: p.color,
              animationDelay: `${p.delay}s`,
              transform: `rotate(${p.rotate}deg)`,
            }}
          />
        ))}
      </div>

      <div
        className={clsx(
          "relative w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-card",
          "animate-[reward-pop-in_0.35s_ease-out]"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 text-5xl">{emoji}</div>
        <h2 className="mb-1 text-lg font-bold text-raksha-700">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        <button
          onClick={onClose}
          className="mt-4 min-h-10 rounded-lg bg-raksha-600 px-4 py-2 text-sm font-semibold text-white hover:bg-raksha-700"
        >
          Nice! 🎉
        </button>
      </div>

      <style jsx global>{`
        @keyframes reward-confetti-fall {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
        @keyframes reward-pop-in {
          0% {
            transform: scale(0.85);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
