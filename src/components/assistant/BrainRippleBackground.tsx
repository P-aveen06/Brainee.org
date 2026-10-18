"use client";

import { cn } from "@/lib/utils";

interface BrainRippleBackgroundProps {
	className?: string;
}

/**
 * Concentric liquid ripple background inspired by Kore.ai's agentic hero aura.
 * Renders layered atmospheric water pool blooms and concentric Gaussian-blurred SVG waves.
 */
export function BrainRippleBackground({
	className,
}: BrainRippleBackgroundProps) {
	return (
		<div
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden select-none",
				className,
			)}
		>
			{/* Water Pool Radial Glows */}
			<div className="absolute top-[36%] left-1/2 -translate-x-1/2 -translate-y-1/2 size-[680px] rounded-full bg-gradient-to-tr from-sky-300/40 via-blue-200/35 to-indigo-100/30 dark:from-blue-600/20 dark:via-sky-600/15 dark:to-transparent blur-3xl pointer-events-none" />
			<div className="absolute top-[36%] left-1/2 -translate-x-1/2 -translate-y-1/2 size-[340px] rounded-full bg-sky-300/40 dark:bg-sky-500/20 blur-2xl pointer-events-none" />

			{/* Concentric Ripple Waves SVG (Inspired by Kore.ai) */}
			<div className="absolute top-[36%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1600px] h-[1600px] max-w-none flex items-center justify-center animate-ripple-breathe pointer-events-none">
				<svg
					viewBox="0 0 1000 1000"
					className="w-full h-full"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
					aria-hidden="true"
				>
					<title>Concentric Ripple Background</title>
					<defs>
						<style>{`
							.ripple-wave-circle {
								stroke: url(#ripple-grad-light);
								fill: none;
								vector-effect: non-scaling-stroke;
							}
							:is(.dark) .ripple-wave-circle {
								stroke: url(#ripple-grad-dark);
							}
						`}</style>

						{/* Soft Gaussian blur for liquid wave crest effect */}
						<filter
							id="kore-wave-blur"
							x="-30%"
							y="-30%"
							width="160%"
							height="160%"
							filterUnits="userSpaceOnUse"
						>
							<feGaussianBlur in="SourceGraphic" stdDeviation="18" />
						</filter>

						{/* Light mode gradient */}
						<linearGradient
							id="ripple-grad-light"
							x1="0%"
							y1="0%"
							x2="100%"
							y2="100%"
						>
							<stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
							<stop offset="35%" stopColor="#60a5fa" stopOpacity="0.9" />
							<stop offset="70%" stopColor="#0284c7" stopOpacity="0.85" />
							<stop offset="100%" stopColor="#818cf8" stopOpacity="0.75" />
						</linearGradient>

						{/* Dark mode gradient */}
						<linearGradient
							id="ripple-grad-dark"
							x1="0%"
							y1="0%"
							x2="100%"
							y2="100%"
						>
							<stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
							<stop offset="50%" stopColor="#60a5fa" stopOpacity="0.6" />
							<stop offset="100%" stopColor="#06b6d4" stopOpacity="0.5" />
						</linearGradient>

						{/* Center Luminous Aura */}
						<radialGradient id="center-core" cx="50%" cy="50%" r="50%">
							<stop offset="0%" stopColor="#bae6fd" stopOpacity="0.6" />
							<stop offset="35%" stopColor="#bfdbfe" stopOpacity="0.35" />
							<stop offset="70%" stopColor="#dbeafe" stopOpacity="0.15" />
							<stop offset="100%" stopColor="#eff6ff" stopOpacity="0" />
						</radialGradient>

						{/* Edge Mask to fade smoothly to transparent at edges */}
						<radialGradient id="edge-fade-mask" cx="50%" cy="50%" r="50%">
							<stop offset="0%" stopColor="white" stopOpacity="1" />
							<stop offset="60%" stopColor="white" stopOpacity="0.95" />
							<stop offset="85%" stopColor="white" stopOpacity="0.6" />
							<stop offset="100%" stopColor="white" stopOpacity="0" />
						</radialGradient>
						<mask id="ripple-mask">
							<rect width="1000" height="1000" fill="url(#edge-fade-mask)" />
						</mask>
					</defs>

					<g mask="url(#ripple-mask)">
						{/* Center Core Bloom */}
						<circle cx="500" cy="500" r={260} fill="url(#center-core)" />

						{/* Concentric Wave Rings with Gaussian Blur */}
						<g filter="url(#kore-wave-blur)">
							{/* Wave 1 */}
							<circle
								cx="500"
								cy="500"
								r={115}
								strokeWidth={30}
								stroke="url(#ripple-grad-light)"
								className="ripple-wave-circle"
								opacity={0.46}
							/>
							{/* Wave 2 */}
							<circle
								cx="500"
								cy="500"
								r={195}
								strokeWidth={40}
								stroke="url(#ripple-grad-light)"
								className="ripple-wave-circle"
								opacity={0.4}
							/>
							{/* Wave 3 */}
							<circle
								cx="500"
								cy="500"
								r={290}
								strokeWidth={52}
								stroke="url(#ripple-grad-light)"
								className="ripple-wave-circle"
								opacity={0.34}
							/>
							{/* Wave 4 */}
							<circle
								cx="500"
								cy="500"
								r={400}
								strokeWidth={66}
								stroke="url(#ripple-grad-light)"
								className="ripple-wave-circle"
								opacity={0.27}
							/>
							{/* Wave 5 */}
							<circle
								cx="500"
								cy="500"
								r={525}
								strokeWidth={82}
								stroke="url(#ripple-grad-light)"
								className="ripple-wave-circle"
								opacity={0.2}
							/>
							{/* Wave 6 */}
							<circle
								cx="500"
								cy="500"
								r={665}
								strokeWidth={100}
								stroke="url(#ripple-grad-light)"
								className="ripple-wave-circle"
								opacity={0.14}
							/>
							{/* Wave 7 */}
							<circle
								cx="500"
								cy="500"
								r={820}
								strokeWidth={120}
								stroke="url(#ripple-grad-light)"
								className="ripple-wave-circle"
								opacity={0.08}
							/>
						</g>
					</g>
				</svg>
			</div>
		</div>
	);
}
