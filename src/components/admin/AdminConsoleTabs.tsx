import { useNavigate, useSearch } from "@tanstack/react-router";
import { FileText, House, Palmtree, Settings, Users } from "lucide-react";
import { PageTabs } from "@/components/ui/page-tabs";

const ADMIN_TABS = [
	{ value: "employees", label: "Employees", icon: Users },
	{ value: "holidays", label: "Holidays", icon: Palmtree },
	{
		value: "leave-config",
		label: "Leave Config",
		icon: Settings,
	},
	{ value: "wfh", label: "WFH", icon: House },
	{ value: "audit", label: "Audit", icon: FileText },
] as const;

type TabValue = (typeof ADMIN_TABS)[number]["value"];

interface AdminConsoleTabsProps {
	employeesContent: React.ReactNode;
	holidaysContent: React.ReactNode;
	leaveConfigContent: React.ReactNode;
	wfhContent: React.ReactNode;
	auditContent: React.ReactNode;
}

export function AdminConsoleTabs({
	employeesContent,
	holidaysContent,
	leaveConfigContent,
	wfhContent,
	auditContent,
}: AdminConsoleTabsProps) {
	const navigate = useNavigate();
	const search = useSearch({ from: "/_authenticated/admin/" });
	const currentTab: TabValue = search.tab || "employees";

	const handleTabChange = (value: string) => {
		navigate({
			to: "/admin",
			search: (prev) => ({
				...prev,
				tab: value === "employees" ? undefined : (value as TabValue),
			}),
		});
	};

	const contentMap: Record<TabValue, React.ReactNode> = {
		employees: employeesContent,
		holidays: holidaysContent,
		"leave-config": leaveConfigContent,
		wfh: wfhContent,
		audit: auditContent,
	};

	return (
		<div className="space-y-6">
			<PageTabs
				items={ADMIN_TABS.map(({ value, label, icon: Icon }) => ({
					value,
					label: (
						<span className="flex items-center gap-1.5">
							<Icon className="h-3.5 w-3.5" aria-hidden="true" />
							{label}
						</span>
					),
				}))}
				value={currentTab}
				onChange={handleTabChange}
				ariaLabel="Administration sections"
			/>

			<div>{contentMap[currentTab]}</div>
		</div>
	);
}
