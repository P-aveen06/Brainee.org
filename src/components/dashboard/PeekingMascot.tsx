"use client";

import { AnimatePresence, m } from "motion/react";
import type * as React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";

interface PeekingContextValue {
	activeCardId: string | null;
	alignmentPercent: number;
	isScared: boolean;
	isAppearing: boolean;
	duckOffset: number;
	eyeOffset: { x: number; y: number };
	onFrighten: () => void;
	registerHost: (id: string, getRect: () => DOMRect | null) => () => void;
}

const PeekingContext = createContext<PeekingContextValue | null>(null);

/** Hook to determine if a specific card currently hosts the active peeking mascot */
export function useIsCardPeeking(cardId: string): boolean {
	const context = useContext(PeekingContext);
	return context?.activeCardId === cardId;
}

/** Pure Brainee.org Logo face mascot with eye tracking — transparent vectors */
export function BraineeMascotSvg({
	className,
	eyeOffset = { x: 0, y: 0 },
	isScared = false,
}: {
	className?: string;
	eyeOffset?: { x: number; y: number };
	isScared?: boolean;
}) {
	return (
		<svg
			viewBox="0 0 202 135"
			fill="none"
			className={className}
			aria-hidden="true"
		>
			<image href="/brainee-logo.svg" x="34" y="0" width="134" height="134" />
			<g
				style={{
					transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`,
					transition: "transform 120ms ease-out",
				}}
			>
				<circle cx="83" cy="69" r={isScared ? 6 : 4} fill="var(--foreground)" />
				<circle
					cx="119"
					cy="69"
					r={isScared ? 6 : 4}
					fill="var(--foreground)"
				/>
			</g>
		</svg>
	);
}

/**
 * Provider that randomly summons the Brainee.org Logo mascot to peek out from cards.
 * - Slower, gentle entrance (1.2s crawl up)
 * - Less frequent appearances (rare easter egg, 18-34s intervals)
 * - Only within grid cards at the top rim (never hero, never outer ends)
 */
export function PeekingMascotProvider({
	children,
	enabled = true,
}: {
	children: React.ReactNode;
	enabled?: boolean;
}) {
	const [activeCardId, setActiveCardId] = useState<string | null>(null);
	const [alignmentPercent, setAlignmentPercent] = useState<number>(50);
	const [isScared, setIsScared] = useState(false);
	const [isAppearing, setIsAppearing] = useState(false);
	const [duckOffset, setDuckOffset] = useState(0);
	const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });

	const hostsRef = useRef<Map<string, () => DOMRect | null>>(new Map());
	const lastCardIdRef = useRef<string | null>(null);

	const peekTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
	const autoHideTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
	const appearTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
	const scheduleNextPeekRef = useRef<(delayMs: number) => void>(() => {});

	// Stable registerHost callback so it never causes child effect re-runs
	const registerHost = useCallback(
		(id: string, getRect: () => DOMRect | null) => {
			hostsRef.current.set(id, getRect);
			return () => {
				hostsRef.current.delete(id);
			};
		},
		[],
	);

	// Gentle, responsive retreat when user gets right on top of mascot or clicks
	const flee = useCallback(() => {
		if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
		if (appearTimerRef.current) clearTimeout(appearTimerRef.current);
		setIsScared(true);
		// Quick cute retreat over 350ms
		setTimeout(() => {
			setActiveCardId(null);
			setIsScared(false);
			setIsAppearing(false);
			setDuckOffset(0);
			setEyeOffset({ x: 0, y: 0 });
			// Relocate to next card quickly after 2.5 to 4.5 seconds
			scheduleNextPeekRef.current(2500 + Math.random() * 2000);
		}, 350);
	}, []);

	// Calm relocation when left alone on a card
	const calmRelocate = useCallback(() => {
		if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
		if (appearTimerRef.current) clearTimeout(appearTimerRef.current);
		setIsScared(true);
		setTimeout(() => {
			setActiveCardId(null);
			setIsScared(false);
			setIsAppearing(false);
			setDuckOffset(0);
			setEyeOffset({ x: 0, y: 0 });
			// Relocate to next card after 3 to 5 seconds
			scheduleNextPeekRef.current(3000 + Math.random() * 2000);
		}, 400);
	}, []);

	const scheduleNextPeek = useCallback(
		(delayMs: number) => {
			if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
			peekTimerRef.current = setTimeout(() => {
				const allHosts = Array.from(hostsRef.current.keys());
				// ONLY cards within the dashboard grid — NEVER top hero card, NEVER outer ends!
				const gridHosts = allHosts.filter((id) => id !== "hero");
				if (gridHosts.length > 0) {
					// Always pick a DIFFERENT card than the previous card
					const otherCards = gridHosts.filter(
						(id) => id !== lastCardIdRef.current,
					);
					const candidates = otherCards.length > 0 ? otherCards : gridHosts;
					const randomCard =
						candidates[Math.floor(Math.random() * candidates.length)];
					lastCardIdRef.current = randomCard;

					// Alignment along the top edge: 25% to 75%
					const randomAlign = 25 + Math.floor(Math.random() * 50);

					setActiveCardId(randomCard);
					setAlignmentPercent(randomAlign);
					setIsScared(false);
					setIsAppearing(true);
					setDuckOffset(0);
					setEyeOffset({ x: 0, y: 0 });

					if (appearTimerRef.current) clearTimeout(appearTimerRef.current);
					appearTimerRef.current = setTimeout(() => {
						setIsAppearing(false);
					}, 900);

					// Hang out for 8.5 seconds before gently relocating
					if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
					autoHideTimerRef.current = setTimeout(() => {
						calmRelocate();
					}, 8500);
				} else {
					scheduleNextPeekRef.current(1000);
				}
			}, delayMs);
		},
		[calmRelocate],
	);
	scheduleNextPeekRef.current = scheduleNextPeek;

	// Global hook so mascot can be summoned immediately
	useEffect(() => {
		if (typeof window !== "undefined") {
			(window as unknown as { __triggerMascot?: () => void }).__triggerMascot =
				() => {
					const allHosts = Array.from(hostsRef.current.keys());
					const gridHosts = allHosts.filter((id) => id !== "hero");
					if (gridHosts.length > 0) {
						const otherCards = gridHosts.filter(
							(id) => id !== lastCardIdRef.current,
						);
						const candidates = otherCards.length > 0 ? otherCards : gridHosts;
						const randomCard =
							candidates[Math.floor(Math.random() * candidates.length)];
						lastCardIdRef.current = randomCard;

						const randomAlign = 25 + Math.floor(Math.random() * 50);

						setActiveCardId(randomCard);
						setAlignmentPercent(randomAlign);
						setIsScared(false);
						setIsAppearing(true);
						setDuckOffset(0);
						setEyeOffset({ x: 0, y: 0 });
						setTimeout(() => setIsAppearing(false), 2000);
					}
				};
		}
	}, []);

	// Proximity detection: calm, smooth ducking when cursor approaches
	useEffect(() => {
		if (!activeCardId || !enabled) return;

		function handlePointerMove(e: PointerEvent) {
			if (!activeCardId) return;
			const getRect = hostsRef.current.get(activeCardId);
			const rect = getRect ? getRect() : null;
			if (!rect) return;

			// Mascot center position at top rim of the card
			const mascotCenterX = rect.left + (rect.width * alignmentPercent) / 100;
			const mascotCenterY = rect.top - 20;

			const dx = e.clientX - mascotCenterX;
			const dy = e.clientY - mascotCenterY;
			const dist = Math.hypot(dx, dy);

			// Track eye direction towards cursor with high sensitivity
			const eyeX = Math.max(-5, Math.min(5, dx / 20));
			const eyeY = Math.max(-4, Math.min(4, dy / 20));
			setEyeOffset({ x: eyeX, y: eyeY });

			// User can move very close without it disappearing!
			// Only retreats if cursor gets right on top of it (< 16px) or clicks
			if (dist <= 16) {
				flee();
				return;
			}

			// Proximity ducking zone: only activates when cursor is within 50px down to 16px
			// Outside 50px, duckOffset is 0 so the mascot remains fully visible!
			const MAX_PROXIMITY_DIST = 50;
			const MIN_FLEE_DIST = 16;
			const MAX_DUCK_OFFSET = 18;

			if (dist >= MAX_PROXIMITY_DIST) {
				setDuckOffset(0);
			} else {
				const progress =
					1 - (dist - MIN_FLEE_DIST) / (MAX_PROXIMITY_DIST - MIN_FLEE_DIST);
				const smoothed = progress * progress * (3 - 2 * progress);
				setDuckOffset(Math.round(smoothed * MAX_DUCK_OFFSET));
			}
		}

		window.addEventListener("pointermove", handlePointerMove, {
			passive: true,
		});
		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
		};
	}, [activeCardId, alignmentPercent, enabled, flee]);

	// Initial peek scheduling on load - begins promptly after 1.5 seconds
	useEffect(() => {
		if (!enabled) {
			setActiveCardId(null);
			if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
			if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
			if (appearTimerRef.current) clearTimeout(appearTimerRef.current);
			return;
		}

		scheduleNextPeek(1500);

		return () => {
			if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
			if (autoHideTimerRef.current) clearTimeout(autoHideTimerRef.current);
			if (appearTimerRef.current) clearTimeout(appearTimerRef.current);
		};
	}, [enabled, scheduleNextPeek]);

	return (
		<PeekingContext.Provider
			value={{
				activeCardId,
				alignmentPercent,
				isScared,
				isAppearing,
				duckOffset,
				eyeOffset,
				onFrighten: flee,
				registerHost,
			}}
		>
			{children}
		</PeekingContext.Provider>
	);
}

/**
 * Host component mounted behind a card container.
 * Peeks out from behind the top border of cards within the dashboard grid.
 */
export function CardMascotHost({ cardId }: { cardId: string }) {
	const context = useContext(PeekingContext);
	const hostRef = useRef<HTMLDivElement>(null);
	const registerHost = context?.registerHost;

	useEffect(() => {
		if (!registerHost) return;
		return registerHost(cardId, () => {
			return hostRef.current ? hostRef.current.getBoundingClientRect() : null;
		});
	}, [cardId, registerHost]);

	if (!context) return null;

	const isPeeking = context.activeCardId === cardId;

	return (
		<div
			ref={hostRef}
			aria-hidden="true"
			className="pointer-events-none absolute inset-0 z-0 overflow-visible"
		>
			<AnimatePresence>
				{isPeeking && (
					<button
						type="button"
						aria-label="Brainee.org Mascot Peek-a-boo"
						style={{
							left: `${context.alignmentPercent}%`,
							top: 0,
							transform: "translate(-50%, calc(-100% + 2px))",
						}}
						className="pointer-events-auto absolute select-none cursor-pointer border-0 bg-transparent p-0 outline-none"
						onClick={context.onFrighten}
						title="Peek-a-boo!"
					>
						<m.div
							key={`brainee-mascot-${cardId}`}
							initial={{ y: 44, opacity: 0 }}
							animate={{
								y: context.isScared ? 44 : context.duckOffset,
								opacity: context.isScared ? 0 : 1,
								rotate: context.alignmentPercent > 50 ? 1.5 : -1.5,
								scale: context.isScared
									? 0.94
									: 1 - (context.duckOffset / 44) * 0.05,
							}}
							exit={{
								y: 44,
								opacity: 0,
								scale: 0.94,
								transition: {
									duration: 0.35,
									ease: [0.25, 0.1, 0.25, 1],
								},
							}}
							transition={{
								duration: context.isScared
									? 0.35
									: context.isAppearing
										? 0.85
										: 0.2,
								ease: [0.22, 1, 0.36, 1],
							}}
						>
							<div className="relative group">
								<BraineeMascotSvg
									className="h-[38px] w-[57px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.14)] select-none"
									eyeOffset={context.eyeOffset}
									isScared={context.isScared}
								/>
							</div>
						</m.div>
					</button>
				)}
			</AnimatePresence>
		</div>
	);
}
