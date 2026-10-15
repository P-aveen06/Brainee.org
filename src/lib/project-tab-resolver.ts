export const CONSOLIDATED_PROJECT_TABS = [
	"overview",
	"tasks",
	"daily",
	"checklists",
	"documents",
] as const;

export type ConsolidatedTabKey = (typeof CONSOLIDATED_PROJECT_TABS)[number];

/**
 * Resolves a raw tab string (including legacy query param values from bookmarks and notifications)
 * to one of the five consolidated project tabs.
 *
 * Mappings:
 * - undefined / empty -> "overview" (new default)
 * - "tasks" -> "tasks"
 * - "daily", "updates", "eod", "flags" -> "daily"
 * - "checklists" -> "checklists"
 * - "documents", "files" -> "documents"
 * - "discussions" -> "overview" (discussions removed per requirement)
 * - "overview", "members", "team", "client", "timeline" -> "overview"
 */
export function resolveProjectTab(rawTab?: string | null): ConsolidatedTabKey {
	if (!rawTab) return "overview";

	switch (rawTab.toLowerCase().trim()) {
		case "tasks":
			return "tasks";
		case "daily":
		case "updates":
		case "eod":
		case "flags":
			return "daily";
		case "checklists":
			return "checklists";
		case "documents":
		case "files":
			return "documents";
		default:
			return "overview";
	}
}
