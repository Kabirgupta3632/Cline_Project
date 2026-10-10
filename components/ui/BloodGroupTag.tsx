// Generic blood-group pill (A+, O-, etc) with consistent red/white styling.
// Shared UI (Person 3) - imported by hospital, donor, and demo-panel screens.
import type { BloodGroup } from "@/lib/types";
import clsx from "clsx";

export interface BloodGroupTagProps {
  bloodGroup: BloodGroup;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<BloodGroupTagProps["size"]>, string> = {
  sm: "h-7 w-7 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
};

/** Circular blood group badge, e.g. for donor cards / notification rows. */
export function BloodGroupTag({
  bloodGroup,
  size = "md",
  className,
}: BloodGroupTagProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center rounded-full bg-raksha-50 font-bold text-raksha-700 border border-raksha-200",
        SIZE_CLASSES[size],
        className
      )}
    >
      {bloodGroup}
    </span>
  );
}
