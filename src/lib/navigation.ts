import type { LucideIcon } from "lucide-react";
import {
	BarChart3,
	Briefcase,
	CalendarDays,
	CheckSquare,
	ClipboardClock,
	FolderKanban,
	Laptop,
	LayoutDashboard,
	ListChecks,
	Network,
	Settings,
	Settings2,
	ShieldCheck,
	Sparkles,
	Users,
} from "lucide-react";

export type Role = "user" | "lead" | "admin" | "hr";

export interface NavItem {
	href: string;
	label: string;
	icon: LucideIcon;
	allowedRoles: Role[];
	badgeType?: "approvals";
}

export interface NavGroup {
	id: string;
	title: string;
	icon?: LucideIcon;
	items: NavItem[];
}

export const NAV_GROUPS: {
	id: string;
	title: string;
	icon?: LucideIcon;
	items: NavItem[];
}[] = [
	{
		id: "workspace",
		title: "Workspace",
		items: [
			{
				href: "/",
				label: "Dashboard",
				icon: LayoutDashboard,
				allowedRoles: ["user", "lead", "admin", "hr"],
			},
			{
				href: "/assistant",
				label: "Company Brain",
				icon: Sparkles,
				allowedRoles: ["user", "lead", "admin", "hr"],
			},
		],
	},
	{
		id: "projects",
		title: "Projects",
		icon: Briefcase,
		items: [
			{
				href: "/projects",
				label: "Projects",
				icon: FolderKanban,
				allowedRoles: ["user", "lead", "admin", "hr"],
			},
			{
				href: "/my-tasks",
				label: "My Tasks",
				icon: ListChecks,
				allowedRoles: ["user", "lead", "admin", "hr"],
			},
			{
				href: "/admin/projects",
				label: "Project Settings",
				icon: Settings2,
				allowedRoles: ["admin"],
			},
		],
	},
	{
		id: "people",
		title: "People",
		icon: Users,
		items: [
			{
				href: "/calendar",
				label: "My Attendance",
				icon: ClipboardClock,
				allowedRoles: ["user", "lead", "admin", "hr"],
			},
			{
				href: "/team-calendar",
				label: "Team Calendar",
				icon: CalendarDays,
				allowedRoles: ["user", "lead", "admin", "hr"],
			},
			{
				href: "/organization",
				label: "Organization",
				icon: Network,
				allowedRoles: ["user", "lead", "admin", "hr"],
			},
			{
				href: "/approvals",
				label: "Approvals",
				icon: CheckSquare,
				allowedRoles: ["lead", "admin"],
				badgeType: "approvals",
			},
		],
	},
	{
		id: "admin",
		title: "Admin",
		icon: ShieldCheck,
		items: [
			{
				href: "/admin/assets",
				label: "Assets",
				icon: Laptop,
				allowedRoles: ["admin"],
			},
			{
				href: "/admin/stats",
				label: "Admin Stats",
				icon: BarChart3,
				allowedRoles: ["admin"],
			},
			{
				href: "/admin",
				label: "Administration",
				icon: Settings,
				allowedRoles: ["admin"],
			},
		],
	},
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export const getNavigationLinks = (role: Role = "user"): NavItem[] => {
	return NAV_ITEMS.filter((item) => item.allowedRoles.includes(role));
};

export const getNavigationGroups = (role: Role = "user"): NavGroup[] => {
	return NAV_GROUPS.map((group) => ({
		...group,
		items: group.items.filter((item) => item.allowedRoles.includes(role)),
	})).filter((group) => group.items.length > 0);
};

/**
 * Resolves the currently active navigation href using longest-prefix matching.
 * Guarantees that deep nested routes (e.g. /admin/employees/123) correctly highlight
 * their parent destination (/admin) rather than highlighting nothing or colliding with siblings.
 */
export function getActiveHref(
	pathname: string | null | undefined,
	items: { href: string }[],
): string | null {
	if (!pathname) return null;
	let bestMatch: string | null = null;
	for (const item of items) {
		const matches =
			item.href === "/"
				? pathname === "/"
				: pathname === item.href || pathname.startsWith(`${item.href}/`);
		if (matches) {
			if (!bestMatch || item.href.length > bestMatch.length) {
				bestMatch = item.href;
			}
		}
	}
	return bestMatch;
}
