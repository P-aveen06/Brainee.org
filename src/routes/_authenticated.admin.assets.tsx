import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { Boxes, Building2, Key, Plus, Users } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { getAssetsPageData } from "@/api/assets";
import { getDeploymentsPageData } from "@/api/deployments";
import { AssetCatalogTable } from "@/components/assets/AssetCatalogTable";
import { AssetFormDialog } from "@/components/assets/AssetFormDialog";
import { AssetStatsCards } from "@/components/assets/AssetStatsCards";
import { CompanyManagerDialog } from "@/components/assets/CompanyManagerDialog";
import { DeploymentsAndAssignmentsView } from "@/components/assets/DeploymentsAndAssignmentsView";
import { ExpiringAccountsList } from "@/components/assets/ExpiringAccountsList";
import { Page, PageHeader } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { PageTabs } from "@/components/ui/page-tabs";

const assetsSearchSchema = z.object({
	tab: z
		.enum(["inventory", "assignments", "deployments", "accounts", "companies"])
		.optional(),
	filter: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/admin/assets")({
	validateSearch: (search) => assetsSearchSchema.parse(search),
	loader: async () => {
		const [assetsData, deploymentsData] = await Promise.all([
			getAssetsPageData(),
			getDeploymentsPageData(),
		]);
		return { assetsData, deploymentsData };
	},
	component: AdminAssetsPage,
});

const ASSET_TABS = [
	{ value: "inventory", label: "Inventory Catalog", icon: Boxes },
	{
		value: "deployments",
		label: "Deployments & Assignments",
		icon: Users,
	},
	{ value: "accounts", label: "Accounts & Renewals", icon: Key },
] as const;

type TabValue = (typeof ASSET_TABS)[number]["value"];

function AdminAssetsPage() {
	const { assetsData, deploymentsData } = Route.useLoaderData();
	const navigate = useNavigate();
	const search = useSearch({ from: "/_authenticated/admin/assets" });
	const currentTab: TabValue = (search.tab as TabValue) || "inventory";

	const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
	const [newAssetDialogOpen, setNewAssetDialogOpen] = useState(false);

	const handleTabChange = (value: string) => {
		navigate({
			to: "/admin/assets",
			search: (prev) => ({
				...prev,
				tab: value === "inventory" ? undefined : (value as TabValue),
			}),
		});
	};

	const refreshData = () => {
		// Invalidate router data to reload fresh database state
		navigate({
			to: "/admin/assets",
			search: search,
		});
	};

	return (
		<Page>
			<PageHeader
				title="Assets"
				description="Track physical hardware inventory, ID cards, digital credentials, multi-tier client deployments, and return lifecycles."
				actions={
					<>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setCompanyDialogOpen(true)}
							className="gap-1.5"
						>
							<Building2 className="size-4" /> Manage Companies
						</Button>
						<Button
							size="sm"
							onClick={() => setNewAssetDialogOpen(true)}
							className="gap-1.5"
						>
							<Plus className="size-4" /> Add Item / Account
						</Button>
					</>
				}
			/>

			{/* Metric KPI Banner */}
			<AssetStatsCards summary={assetsData.summary} />

			{/* Pill Navigation */}
			<div className="space-y-6">
				<PageTabs
					items={ASSET_TABS.map(({ value, label, icon: Icon }) => ({
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
					ariaLabel="Asset management sections"
				/>

				{/* Tab Contents */}
				{currentTab === "inventory" && (
					<AssetCatalogTable
						assets={assetsData.assets}
						companies={assetsData.companies}
						users={assetsData.users}
						deployments={assetsData.deployments}
						today={assetsData.today}
						onRefresh={refreshData}
					/>
				)}

				{(currentTab === "deployments" ||
					(currentTab as string) === "assignments") && (
					<DeploymentsAndAssignmentsView
						deployments={deploymentsData.deployments}
						assets={assetsData.assets}
						companies={deploymentsData.companies}
						users={deploymentsData.users}
						availableAssets={deploymentsData.availableAssets}
						today={assetsData.today}
						onRefresh={refreshData}
					/>
				)}

				{currentTab === "accounts" && (
					<ExpiringAccountsList
						assets={assetsData.assets}
						today={assetsData.today}
						onRefresh={refreshData}
					/>
				)}
			</div>

			{/* Top-Level Dialogs */}
			<CompanyManagerDialog
				open={companyDialogOpen}
				onOpenChange={setCompanyDialogOpen}
				companies={deploymentsData.companies}
				onSuccess={refreshData}
			/>

			<AssetFormDialog
				open={newAssetDialogOpen}
				onOpenChange={setNewAssetDialogOpen}
				companies={assetsData.companies}
				onSuccess={refreshData}
			/>
		</Page>
	);
}
