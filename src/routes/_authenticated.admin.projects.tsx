import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { getChecklistTemplates } from "@/api/project-checklist-templates";
import { getProjectStageConfig, upsertProjectStage } from "@/api/projects";
import { ChecklistTemplateManager } from "@/components/admin/ChecklistTemplateManager";
import {
	ProjectStagesTable,
	type StageItem,
} from "@/components/admin/ProjectStagesTable";
import { Page, PageHeader } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageTabs } from "@/components/ui/page-tabs";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/projects")({
	loader: async () => {
		const [stageData, templateData] = await Promise.all([
			getProjectStageConfig(),
			getChecklistTemplates(),
		]);
		return {
			stages: stageData.stages,
			templates: templateData.templates,
		};
	},
	component: AdminProjectsPage,
});

const ADMIN_PROJECT_TABS = [
	{ value: "stages", label: "Lifecycle Stages" },
	{ value: "templates", label: "Stage Checklist Templates" },
];

function AdminProjectsPage() {
	const { stages, templates } = Route.useLoaderData();
	const router = useRouter();
	const [activeTab, setActiveTab] = useState("stages");
	const [isPending, startTransition] = useTransition();

	const [dialogOpen, setDialogOpen] = useState(false);
	const [stageToEdit, setStageToEdit] = useState<StageItem | null>(null);

	const [key, setKey] = useState("");
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [sequence, setSequence] = useState("1");

	const handleOpenCreate = () => {
		setStageToEdit(null);
		setKey("");
		setName("");
		setDescription("");
		setSequence(String(stages.length + 1));
		setDialogOpen(true);
	};

	const handleOpenEdit = (stage: StageItem) => {
		setStageToEdit(stage);
		setKey(stage.key);
		setName(stage.name);
		setDescription(stage.description || "");
		setSequence(String(stage.sequence));
		setDialogOpen(true);
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!key.trim() || !name.trim()) return;

		startTransition(async () => {
			try {
				const res = await upsertProjectStage({
					data: {
						id: stageToEdit?.id,
						key: key.trim().toLowerCase().replace(/\s+/g, "_"),
						name: name.trim(),
						description: description.trim() || undefined,
						sequence: Number(sequence) || 0,
					},
				});

				if ("error" in res && res.error) {
					toast.error(res.error);
				} else {
					toast.success(
						stageToEdit
							? "Stage updated successfully"
							: "Lifecycle stage created",
					);
					setDialogOpen(false);
					router.invalidate();
				}
			} catch (_err) {
				toast.error("Failed to save stage");
			}
		});
	};

	return (
		<Page>
			<PageHeader
				title="Project Settings"
				description="Define standardized project phases and default stage checklist requirements enforced across the company."
				actions={
					activeTab === "stages" ? (
						<Button size="sm" onClick={handleOpenCreate}>
							<Plus className="mr-1.5 size-4" />
							Add Lifecycle Stage
						</Button>
					) : undefined
				}
			/>

			{/* Tab Switcher */}
			<PageTabs
				items={ADMIN_PROJECT_TABS}
				value={activeTab}
				onChange={setActiveTab}
				ariaLabel="Project configuration sections"
			/>

			{/* Tab 1: Lifecycle Stages */}
			{activeTab === "stages" && (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<h3 className="font-heading text-sm font-semibold text-foreground">
							Lifecycle Stages ({stages.length})
						</h3>
						<span className="text-xs text-muted-foreground">
							Ordered sequentially from inception to handover
						</span>
					</div>

					<ProjectStagesTable
						stages={stages as StageItem[]}
						onEditStage={handleOpenEdit}
					/>
				</div>
			)}

			{/* Tab 2: Stage Checklist Templates */}
			{activeTab === "templates" && (
				<ChecklistTemplateManager
					stages={stages}
					templates={templates}
					onSuccess={() => router.invalidate()}
				/>
			)}

			{/* Edit/Create Stage Dialog */}
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<form onSubmit={handleSubmit}>
						<DialogHeader>
							<DialogTitle>
								{stageToEdit
									? `Edit Stage: ${stageToEdit.name}`
									: "New Lifecycle Stage"}
							</DialogTitle>
							<DialogDescription>
								Configure stage order, unique key, and guidance for team
								members.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-3.5 py-4">
							<div className="space-y-1.5">
								<Label htmlFor="stageName">Display Name</Label>
								<Input
									id="stageName"
									value={name}
									onChange={(e) => {
										setName(e.target.value);
										if (!stageToEdit) {
											setKey(e.target.value.toLowerCase().replace(/\s+/g, "_"));
										}
									}}
									placeholder="e.g. Inception & Discovery"
									required
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="stageKey">Unique Key</Label>
								<Input
									id="stageKey"
									value={key}
									onChange={(e) => setKey(e.target.value)}
									placeholder="e.g. discovery"
									disabled={Boolean(stageToEdit)}
									className="font-mono text-xs"
									required
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="stageDesc">Description</Label>
								<Textarea
									id="stageDesc"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									placeholder="What needs to happen during this stage..."
									rows={3}
								/>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor="stageSeq">Sequence Number</Label>
								<Input
									id="stageSeq"
									type="number"
									value={sequence}
									onChange={(e) => setSequence(e.target.value)}
									required
								/>
							</div>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setDialogOpen(false)}
								disabled={isPending}
							>
								Cancel
							</Button>
							<Button type="submit" disabled={isPending || !name.trim()}>
								{isPending ? "Saving..." : "Save Stage"}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</Page>
	);
}
