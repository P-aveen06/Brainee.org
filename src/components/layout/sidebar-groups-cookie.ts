export const SIDEBAR_GROUPS_COOKIE_NAME = "sidebar_groups";
export const SIDEBAR_GROUPS_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export function parseCollapsedGroups(value: string | undefined): string[] {
	if (!value) return [];
	try {
		return decodeURIComponent(value).split(",").filter(Boolean);
	} catch {
		return [];
	}
}

export function persistCollapsedGroups(groups: Set<string>) {
	if (typeof document === "undefined") return;
	const val = encodeURIComponent(Array.from(groups).join(","));
	// biome-ignore lint/suspicious/noDocumentCookie: cookie sync for sidebar group collapse state
	document.cookie = `${SIDEBAR_GROUPS_COOKIE_NAME}=${val}; path=/; max-age=${SIDEBAR_GROUPS_COOKIE_MAX_AGE}; SameSite=Lax`;
}
