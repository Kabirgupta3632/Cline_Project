// Generic reusable card wrapper: white bg, rounded corners, card shadow.
// Shared UI (Person 3) - imported by hospital, donor, and demo-panel screens.
import { HTMLAttributes } from "react";
import clsx from "clsx";

export type CardProps = HTMLAttributes<HTMLDivElement>;

/** Plain div wrapper - shadow-card rounded-xl border p-4 bg-white, per spec. */
export function Card({ className, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-gray-200 bg-white p-4 shadow-card",
        className
      )}
      {...rest}
    />
  );
}
