// Generic reusable pill/badge for statuses, urgency, counts, etc.
// Shared UI (Person 3) - imported by hospital, donor, and demo-panel screens.
import { HTMLAttributes } from "react";
import clsx from "clsx";

export type BadgeTone =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "critical"
  | "info";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-gray-100 text-gray-600",
  primary: "bg-raksha-100 text-raksha-700",
  success: "bg-green-100 text-success",
  warning: "bg-yellow-100 text-yellow-800",
  critical: "bg-red-100 text-critical",
  info: "bg-blue-100 text-blue-700",
};

/** Small rounded status pill. Generic - not blood-group specific (see BloodGroupTag). */
export function Badge({ tone = "neutral", className, ...rest }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        TONE_CLASSES[tone],
        className
      )}
      {...rest}
    />
  );
}
