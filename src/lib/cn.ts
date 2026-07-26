import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge class names, with later Tailwind utilities winning over earlier ones.
 *
 * Plain string concatenation cannot do this: `"p-2" + " p-4"` leaves both
 * classes in the DOM and the winner is decided by stylesheet order rather than
 * by the caller. `twMerge` resolves the conflict so component defaults can be
 * overridden by a `className` prop predictably.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
