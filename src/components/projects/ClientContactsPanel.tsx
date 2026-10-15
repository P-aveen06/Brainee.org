import { Building2, Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface ClientContactItem {
	id: string;
	name: string;
	title?: string | null;
	email?: string | null;
	phone?: string | null;
	role: string;
	isPrimary: boolean;
	notes?: string | null;
}

export interface ClientCompany {
	id: string;
	name: string;
	code: string;
	contactEmail?: string | null;
	notes?: string | null;
}

interface ClientContactsPanelProps {
	client?: ClientCompany | null;
	clientProjectName?: string | null;
	engagementModel?: string | null;
	contractValue?: number | null;
	currency?: string | null;
	contacts: ClientContactItem[];
}

export function ClientContactsPanel({
	client,
	clientProjectName,
	engagementModel,
	contractValue,
	currency = "INR",
	contacts,
}: ClientContactsPanelProps) {
	if (!client) {
		return (
			<div className="rounded-lg border border-border bg-card p-5 text-center text-muted-foreground">
				<Building2 className="mx-auto size-8 opacity-30 mb-2" />
				<p className="text-sm font-medium">Internal Project</p>
				<p className="text-xs mt-1">
					This project has no external client organization associated with it.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Commercial Summary Card */}
			<div className="rounded-lg border border-border bg-card p-5">
				<div className="flex items-start justify-between gap-4">
					<div>
						<span className="text-xs font-semibold text-primary uppercase tracking-wider">
							Client Organization
						</span>
						<h3 className="font-heading text-lg font-semibold text-foreground mt-0.5">
							{client.name} ({client.code})
						</h3>
						{clientProjectName && (
							<p className="text-xs text-muted-foreground mt-0.5">
								Client ref:{" "}
								<span className="font-medium text-foreground">
									{clientProjectName}
								</span>
							</p>
						)}
					</div>
					{engagementModel && (
						<Badge variant="outline" className="capitalize text-xs">
							{engagementModel.replace(/_/g, " ")}
						</Badge>
					)}
				</div>

				<div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-border/60 text-xs">
					<div>
						<span className="text-muted-foreground block">
							Engagement Model
						</span>
						<span className="font-medium capitalize mt-0.5 block">
							{engagementModel?.replace(/_/g, " ") || "—"}
						</span>
					</div>
					<div>
						<span className="text-muted-foreground block">Contract Value</span>
						<span className="font-medium mt-0.5 block">
							{contractValue != null
								? `${currency} ${contractValue.toLocaleString("en-IN")}`
								: "—"}
						</span>
					</div>
					<div>
						<span className="text-muted-foreground block">Client Email</span>
						<span className="font-medium mt-0.5 block">
							{client.contactEmail || "—"}
						</span>
					</div>
				</div>
			</div>

			{/* Client Stakeholders */}
			<div className="space-y-3">
				<h4 className="font-heading text-sm font-semibold text-foreground">
					Client Stakeholders & Contacts ({contacts.length})
				</h4>

				{contacts.length === 0 ? (
					<div className="rounded-md border border-border/70 p-4 text-center text-xs text-muted-foreground bg-muted/20">
						No specific client contact records listed for this organization.
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{contacts.map((contact) => (
							<div
								key={contact.id}
								className="rounded-md border border-border bg-card p-4 space-y-2"
							>
								<div className="flex items-start justify-between gap-2">
									<div>
										<p className="text-sm font-medium text-foreground flex items-center gap-1.5">
											{contact.name}
											{contact.isPrimary && (
												<span className="rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-1.5 py-0.2">
													Primary
												</span>
											)}
										</p>
										{contact.title && (
											<p className="text-xs text-muted-foreground">
												{contact.title}
											</p>
										)}
									</div>
									<Badge variant="secondary" className="capitalize text-[11px]">
										{contact.role}
									</Badge>
								</div>

								<div className="pt-2 border-t border-border/50 space-y-1 text-xs text-muted-foreground">
									{contact.email && (
										<div className="flex items-center gap-2">
											<Mail className="size-3 shrink-0" />
											<a
												href={`mailto:${contact.email}`}
												className="hover:text-primary truncate"
											>
												{contact.email}
											</a>
										</div>
									)}
									{contact.phone && (
										<div className="flex items-center gap-2">
											<Phone className="size-3 shrink-0" />
											<span>{contact.phone}</span>
										</div>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
