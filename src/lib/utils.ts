import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Avatar initials from a display name. Splits on runs of whitespace and drops empty
 * segments — "Charan  Kumar" or a trailing space otherwise yields an `undefined`
 * segment that renders literally as "UN"/"CU".
 */
export function getInitials(name: string | null | undefined): string {
	const parts = (name ?? "").split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "U";
	return parts
		.map((p) => p[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}
