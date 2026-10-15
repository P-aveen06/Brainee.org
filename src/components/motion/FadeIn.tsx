import { m, type Variants } from "motion/react";
import type * as React from "react";

const EASE = [0.2, 0, 0, 1] as const;

const itemVariants: Variants = {
	hidden: { opacity: 0, y: 8 },
	show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
};

const listVariants: Variants = {
	hidden: {},
	show: { transition: { staggerChildren: 0.05 } },
};

interface MotionDivProps {
	className?: string;
	children: React.ReactNode;
}

/**
 * Fades + slides children in one after another. Wrap each child in
 * `StaggerItem`. Content starts hidden, so it appears once JS hydrates.
 */
export function StaggerList({
	className,
	style,
	children,
}: MotionDivProps & { style?: React.CSSProperties }) {
	return (
		<m.div
			className={className}
			style={style}
			variants={listVariants}
			initial="hidden"
			animate="show"
		>
			{children}
		</m.div>
	);
}

export function StaggerItem({ className, children }: MotionDivProps) {
	return (
		<m.div className={className} variants={itemVariants}>
			{children}
		</m.div>
	);
}

export function FadeIn({
	className,
	children,
	delay = 0,
}: MotionDivProps & { delay?: number }) {
	return (
		<m.div
			className={className}
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, ease: EASE, delay }}
		>
			{children}
		</m.div>
	);
}
