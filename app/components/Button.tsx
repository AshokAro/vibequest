"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type ButtonSize = "sm" | "md" | "lg" | "icon";
type ButtonVariant = "primary" | "secondary" | "success" | "danger";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  className?: string;
  ariaLabel?: string;
  type?: "button" | "submit" | "reset";
}

// Selectable pill button props (for mood, energy, interests)
interface SelectablePillProps {
  children: ReactNode;
  onClick?: () => void;
  selected: boolean;
  selectedClassName: string; // Background color when selected
  unselectedClassName?: string; // Optional: custom unselected style
  className?: string;
  ariaLabel?: string;
}

// Icon button props (for header buttons with icons only)
interface IconButtonProps {
  onClick?: () => void;
  icon: React.ElementType;
  ariaLabel: string;
  variant?: "primary" | "secondary" | "success" | "danger";
  className?: string;
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-3 text-sm rounded-xl",
  lg: "w-full py-4 px-6 text-lg rounded-2xl",
  icon: "w-9 h-9 rounded-lg",
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-[#ff6b9d] text-white",
  secondary: "bg-white text-[#1a1a1a]",
  success: "bg-[#a3e635] text-[#1a1a1a]",
  danger: "bg-white text-[#666]",
};

const shadowClasses: Record<ButtonSize, string> = {
  sm: "hard-shadow-sm",
  md: "hard-shadow-sm",
  lg: "hard-shadow",
  icon: "hard-shadow-sm",
};

export function Button({
  children,
  onClick,
  disabled = false,
  size = "md",
  variant = "primary",
  fullWidth = false,
  className,
  ariaLabel,
  type = "button",
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        // Base styles
        "font-black tap-target transition-all duration-200 border-2 border-[#1a1a1a] inline-flex items-center justify-center gap-2",
        // Size styles
        sizeClasses[size],
        // Variant styles
        variantClasses[variant],
        // Shadow styles (disabled state removes shadow)
        !disabled && shadowClasses[size],
        // Hover effect (disabled state removes hover)
        !disabled && "hard-shadow-hover",
        // Disabled styles (use !important to override any custom className colors)
        disabled && "!bg-[#e5e5e5] !text-[#999] border-[#ccc] cursor-not-allowed shadow-none",
        // Full width
        fullWidth && "w-full",
        // Custom classes
        className
      )}
    >
      {children}
    </button>
  );
}

// Special circular button for accept/discard actions
interface CircleButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "success" | "danger";
  className?: string;
  ariaLabel?: string;
}

const circleSizeClasses: Record<string, string> = {
  sm: "w-10 h-10",
  md: "w-14 h-14",
  lg: "w-16 h-16",
};

const circleShadowClasses: Record<string, string> = {
  sm: "hard-shadow-sm",
  md: "hard-shadow-sm",
  lg: "hard-shadow",
};

export function CircleButton({
  children,
  onClick,
  disabled = false,
  size = "md",
  variant = "primary",
  className,
  ariaLabel,
}: CircleButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        // Base styles
        "rounded-full flex items-center justify-center tap-target transition-all duration-200 border-2 border-[#1a1a1a]",
        // Size styles
        circleSizeClasses[size],
        // Variant styles
        variantClasses[variant],
        // Shadow styles
        !disabled && circleShadowClasses[size],
        // Hover effect
        !disabled && "hard-shadow-hover",
        // Disabled styles (use !important to override any custom className colors)
        disabled && "!bg-[#e5e5e5] !text-[#999] border-[#ccc] cursor-not-allowed shadow-none",
        // Custom classes
        className
      )}
    >
      {children}
    </button>
  );
}

// Selectable pill button (for mood, energy, interests, quest types)
export function SelectablePill({
  children,
  onClick,
  selected,
  selectedClassName,
  unselectedClassName,
  className,
  ariaLabel,
}: SelectablePillProps) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        // Base styles
        "flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-[#1a1a1a] tap-target transition-all duration-200 hard-shadow-sm font-bold text-sm",
        // Selected state: colored background with shadow and lift
        selected && `${selectedClassName} text-white hard-shadow -translate-y-0.5`,
        // Unselected state: white background with hover
        !selected && (unselectedClassName || "bg-white text-[#1a1a1a] hard-shadow-hover"),
        // Custom classes
        className
      )}
    >
      {children}
    </button>
  );
}

// Icon button for header/navigation (square with icon)
export function IconButton({
  onClick,
  icon: Icon,
  ariaLabel,
  variant = "secondary",
  className,
}: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        // Base styles
        "w-9 h-9 rounded-lg flex items-center justify-center tap-target transition-all duration-200 border-2 border-[#1a1a1a] hard-shadow-sm",
        // Variant styles
        variantClasses[variant],
        // Hover effect
        "hard-shadow-hover",
        // Custom classes
        className
      )}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
