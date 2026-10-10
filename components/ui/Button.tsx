// Generic reusable button with big touch targets & the raksha red/white theme.
// Shared UI (Person 3) - imported by hospital, donor, and demo-panel screens.
import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-raksha-600 text-white hover:bg-raksha-700 active:bg-raksha-800 disabled:bg-raksha-300",
  secondary:
    "bg-white text-raksha-700 border-2 border-raksha-500 hover:bg-raksha-50 active:bg-raksha-100 disabled:text-raksha-300 disabled:border-raksha-200",
  danger:
    "bg-critical text-white hover:opacity-90 active:opacity-80 disabled:opacity-50",
  ghost:
    "bg-transparent text-raksha-700 hover:bg-raksha-50 active:bg-raksha-100 disabled:text-gray-300",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-[2.5rem] px-3 text-sm",
  md: "min-h-12 px-4 text-base",
  lg: "min-h-14 px-6 text-lg",
};

/**
 * Generic action button. Keep props minimal/generic (variant + size) so every
 * screen (hospital dashboard, donor mobile UI, demo panel) can reuse it
 * without pulling in feature-specific logic.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", fullWidth, className, ...rest },
    ref
  ) {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center rounded-lg font-semibold shadow-card transition-colors disabled:cursor-not-allowed disabled:shadow-none",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          fullWidth && "w-full",
          className
        )}
        {...rest}
      />
    );
  }
);
