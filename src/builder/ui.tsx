/**
 * Builder chrome kit
 * ------------------
 * The small set of controls the builder's own interface is made of.
 *
 * Two rules shape this file:
 *
 * 1. **Use the SDK's own colour scale, not Tailwind's palette.** The package
 *    redefines `--gray-*` under `[data-theme="dark"]` so the ramp *inverts*
 *    (`--gray-100` is `#ededed` in light and `#181818` in dark). Styling the
 *    chrome with `gray-*` therefore themes itself, and the parallel set of
 *    hand-written `dark:` variants disappears — one source of truth instead of
 *    two that drift.
 *
 *    Semantic aliases (`bg-surface`, `text-secondary`, `border-default`) exist
 *    too and are preferred where one fits; the ramp covers everything else.
 *
 * 2. **Use the SDK's type scale.** The package defines `--text-xs` … `--text-3xl`
 *    with matching line-height, weight, and tracking, wired into Tailwind's
 *    `text-*` utilities. Arbitrary `text-[11px]` values opt out of that scale
 *    and drift from the components rendered on the canvas.
 *
 * Centralising these means the panels describe layout and behaviour, not
 * colour values.
 */

import type { ComponentProps, ReactNode } from "react"

import { cn } from "../lib/cn"

/* -------------------------------------------------------------------------- */
/* Layering                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Fixed z-index scale. A named scale keeps stacking decisions reviewable;
 * arbitrary `z-[9999]` values are how overlays start fighting each other.
 */
export const Z = {
  canvasOverlay: "z-10",
  panelHeader: "z-20",
  popover: "z-30",
  modal: "z-40",
} as const

/* -------------------------------------------------------------------------- */
/* Buttons                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "default" | "active" | "danger" | "ghost"

const BUTTON_BASE =
  "inline-flex shrink-0 select-none items-center justify-center gap-1.5 rounded-md " +
  "border text-xs font-medium transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 " +
  "disabled:pointer-events-none disabled:opacity-40"

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  default: "border-default bg-surface text-secondary hover:bg-gray-100 hover:text-gray-900",
  active: "border-transparent bg-blue-600 text-white hover:bg-blue-700",
  danger: "border-default bg-surface text-red-600 hover:bg-red-50",
  ghost: "border-transparent bg-transparent text-secondary hover:bg-gray-100 hover:text-gray-900",
}

export function ToolButton({
  variant = "default",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], "h-7 px-2.5", className)}
      {...props}
    />
  )
}

/**
 * Square control that shows only an icon or glyph.
 * `label` is required and becomes both the tooltip and the accessible name —
 * an icon-only button with no accessible name is unusable with a screen reader.
 */
export function IconButton({
  label,
  variant = "ghost",
  className,
  children,
  ...props
}: ComponentProps<"button"> & { label: string; variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(BUTTON_BASE, BUTTON_VARIANTS[variant], "size-7", className)}
      {...props}
    >
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Shared field styling.
 *
 * `appearance-none` is deliberate and load-bearing: the SDK's base layer already
 * applies it to every `input`/`select`, which strips a `select`'s intrinsic
 * width. Declaring it here keeps the behaviour explicit rather than surprising,
 * and `Select` below pins its own width.
 */
const FIELD_BASE =
  "w-full appearance-none rounded-md border border-default bg-surface px-2 text-xs " +
  "text-gray-900 placeholder:text-tertiary transition-colors " +
  "focus:border-blue-500 focus:outline-2 focus:outline-offset-0 focus:outline-blue-500/20"

export function TextField({ className, ...props }: ComponentProps<"input">) {
  // `min-w-0` keeps the field from forcing a flex parent wider than its track.
  return <input className={cn(FIELD_BASE, "h-7 min-w-0", className)} {...props} />
}

export function TextAreaField({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(FIELD_BASE, "resize-none py-1.5", className)} {...props} />
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        FIELD_BASE,
        // Width must be explicit (see the `appearance-none` note on FIELD_BASE),
        // and `flex-none` is required because these sit in flex toolbars where
        // FIELD_BASE's `w-full` would otherwise let them stretch or collapse.
        "h-7 w-34 flex-none pr-6",
        // Chevron drawn as a background image since the native one is gone.
        "bg-[length:11px] bg-[right_0.45rem_center] bg-no-repeat",
        "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%238e8e8e%22%20stroke-width%3D%223%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')]",
        className,
      )}
      {...props}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Structure                                                                   */
/* -------------------------------------------------------------------------- */

/** Small uppercase section label used in the palette and side panels. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3
      className={cn(
        "px-1 pb-1.5 text-xs font-semibold uppercase tracking-wider text-tertiary",
        className,
      )}
    >
      {children}
    </h3>
  )
}

/** Sticky header for a side panel. */
export function PanelHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        "sticky top-0 flex shrink-0 items-center gap-2 border-b border-subtle bg-surface px-3 py-2.5",
        Z.panelHeader,
        className,
      )}
    >
      {children}
    </header>
  )
}

/** Thin vertical rule separating toolbar groups. */
export function ToolbarDivider() {
  return <div aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-gray-200" />
}

/**
 * Empty state.
 *
 * Always renders one clear next action when given one — an empty state that
 * only says "nothing here" leaves the user to guess.
 */
export function EmptyState({
  title,
  hint,
  action,
  className,
}: {
  title: string
  hint?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 px-6 py-8 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium text-balance text-secondary">{title}</p>
      {hint ? <p className="max-w-56 text-xs text-pretty text-tertiary">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
