import { Plus } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import {
	type LayoutEntry,
	WIDGETS,
	type WidgetId,
} from "#/lib/dashboard-layout";

export function EditLayoutBar({
	hidden,
	saving,
	onAdd,
	onReset,
	onCancel,
	onSave,
}: {
	hidden: LayoutEntry[];
	saving: boolean;
	onAdd: (id: WidgetId) => void;
	onReset: () => void;
	onCancel: () => void;
	onSave: () => void;
}) {
	return (
		<Card variant="subtle" className="p-3 sm:p-3.5">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div className="min-w-0">
					<p className="text-sm font-semibold">Editing layout</p>
					<p className="text-xs text-muted-foreground">
						Drag cards to rearrange. Use × to hide one.
					</p>
					{hidden.length > 0 && (
						<div className="mt-2 flex flex-wrap items-center gap-1.5">
							<span className="text-[11px] text-muted-foreground">Add:</span>
							{hidden.map((h) => (
								<Button
									key={h.id}
									variant="secondary"
									size="xs"
									onClick={() => onAdd(h.id)}
								>
									<Plus />
									{WIDGETS[h.id].title}
								</Button>
							))}
						</div>
					)}
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Button variant="ghost" onClick={onReset} disabled={saving}>
						Reset
					</Button>
					<Button variant="outline" onClick={onCancel} disabled={saving}>
						Cancel
					</Button>
					<Button onClick={onSave} disabled={saving}>
						{saving ? "Saving..." : "Save layout"}
					</Button>
				</div>
			</div>
		</Card>
	);
}
