import { animate } from "motion/react";
import { useEffect, useRef, useState } from "react";

/** Tweens between numeric values when `value` changes. Renders `value` on first paint. */
export function AnimatedNumber({ value }: { value: number }) {
	const [display, setDisplay] = useState(value);
	const from = useRef(value);

	useEffect(() => {
		if (from.current === value) return;
		const controls = animate(from.current, value, {
			duration: 0.45,
			ease: [0.2, 0, 0, 1],
			onUpdate: (v) => setDisplay(v),
			onComplete: () => {
				from.current = value;
			},
		});
		return () => controls.stop();
	}, [value]);

	const decimals = Number.isInteger(value) ? 0 : 1;
	return <>{display.toFixed(decimals)}</>;
}
