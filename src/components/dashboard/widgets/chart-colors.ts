/** One restrained palette for every dashboard chart. */
export const CHART = {
	ink: "var(--primary)",
	wfh: "#06b6d4",
	leave: "#f59e0b",
} as const;

// Leave types avoid cyan (WFH) and amber (on leave) so colours keep one meaning.
export const LEAVE_TYPE_COLORS = [
	"var(--accent)",
	"#6647f0",
	"#10b981",
	"#ec4899",
	"#64748b",
];
