import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import type * as React from "react";

/** Lazy-loads motion's DOM features and honours the OS reduced-motion setting. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
	return (
		<LazyMotion features={domAnimation}>
			<MotionConfig reducedMotion="user">{children}</MotionConfig>
		</LazyMotion>
	);
}
