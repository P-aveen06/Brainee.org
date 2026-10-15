import {
	createFileRoute,
	useRouteContext,
	useRouter,
} from "@tanstack/react-router";
import {
	Building2,
	Calendar,
	CalendarClock,
	ChevronRight,
	Clock,
	LogOut,
	Mail,
	ShieldCheck,
	User,
} from "lucide-react";
import { useState } from "react";
import { logoutUser } from "#/api/auth";
import {
	type EmployeeDeploymentItem,
	EmployeeEquipmentSection,
} from "#/components/assets/EmployeeEquipmentSection";
import { Page, PageHeader } from "#/components/layout/page-layout";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { formatDateDisplay } from "#/lib/date-format";
import { getInitials } from "#/lib/utils";

export const Route = createFileRoute("/_authenticated/profile")({
	component: ProfilePage,
});

function ProfilePage() {
	const { user } = useRouteContext({ from: "/_authenticated" });
	const router = useRouter();
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [deployments, setDeployments] = useState<EmployeeDeploymentItem[]>([]);

	const initials = getInitials(user?.name);

	const cleanCompanyName = (name?: string | null) => {
		if (!name) return "";
		return name.replace(/\s*\([^)]*\)$/, "").trim();
	};

	const handleSignOut = async () => {
		try {
			setIsLoggingOut(true);
			await logoutUser();
			router.navigate({ to: "/sign-in/$" });
		} catch (err: unknown) {
			if (
				err &&
				typeof err === "object" &&
				("to" in err ||
					"href" in err ||
					"isSerializedRedirect" in err ||
					(err as Record<string, unknown>).options)
			) {
				router.navigate({ to: "/sign-in/$" });
				return;
			}
			console.error("Sign out failed:", err);
			setIsLoggingOut(false);
		}
	};

	return (
		<Page>
			<PageHeader
				title="Profile & Account"
				description="Personal information, active client deployment, and equipment custody."
			/>

			{/* Responsive 2-Column Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
				{/* Left Column: Personal Profile & Employment Information */}
				<div className="lg:col-span-5 space-y-4">
					<Card className="border-border/60 bg-card">
						<CardHeader className="p-5 pb-4 border-b border-border/40">
							<CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
								<User className="size-4 text-muted-foreground" /> Profile &
								Account
							</CardTitle>
							<CardDescription className="text-xs text-muted-foreground mt-0.5">
								Personal profile and employment information
							</CardDescription>
						</CardHeader>

						<CardContent className="p-5 space-y-4">
							{/* User Identity Row */}
							<div className="flex items-center gap-3">
								<Avatar className="size-12 border border-border">
									<AvatarImage
										src={user?.avatarUrl || undefined}
										alt={user?.name}
									/>
									<AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
										{initials}
									</AvatarFallback>
								</Avatar>

								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<h2 className="text-sm font-bold text-foreground truncate">
											{user?.name}
										</h2>
										<Badge
											variant="outline"
											className="capitalize font-mono text-[10px] h-4 px-1 shrink-0"
										>
											<ShieldCheck className="size-2.5 text-primary mr-0.5" />
											{user?.role}
										</Badge>
									</div>
									<p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
										<Mail className="size-3 text-muted-foreground/70 shrink-0" />
										<span className="truncate">{user?.email}</span>
									</p>
								</div>
							</div>

							{/* Clean Detail Rows (ZERO inner boxes, hairline dividers) */}
							<div className="divide-y divide-border/40 text-xs">
								<div className="flex items-center justify-between py-2.5 first:pt-1">
									<span className="text-muted-foreground flex items-center gap-1.5">
										<CalendarClock className="size-3.5 text-primary/70 shrink-0" />{" "}
										Join Date
									</span>
									<span className="font-medium text-foreground">
										{user?.joinDate
											? formatDateDisplay(user.joinDate)
											: "Not set"}
									</span>
								</div>

								<div className="flex items-center justify-between py-2.5">
									<span className="text-muted-foreground flex items-center gap-1.5">
										<Calendar className="size-3.5 text-primary/70 shrink-0" />{" "}
										Birthday
									</span>
									<span className="font-medium text-foreground">
										{user?.birthday
											? formatDateDisplay(user.birthday)
											: "Not set"}
									</span>
								</div>

								<div className="flex items-center justify-between py-2.5">
									<span className="text-muted-foreground flex items-center gap-1.5">
										<Clock className="size-3.5 text-primary/70 shrink-0" />{" "}
										Standard Hours
									</span>
									<span className="font-medium text-foreground">
										{user?.standardHours || 8} hrs/day
									</span>
								</div>

								<div className="flex items-center justify-between py-2.5 last:pb-1">
									<span className="text-muted-foreground flex items-center gap-1.5">
										<Building2 className="size-3.5 text-primary/70 shrink-0" />{" "}
										Client Deployment
									</span>
									{deployments.length > 0 ? (
										<div className="text-right">
											<span className="font-semibold text-foreground flex items-center gap-1">
												Brainee.org{" "}
												<ChevronRight className="size-3 text-muted-foreground" />
												<span className="text-primary font-bold">
													{cleanCompanyName(
														deployments[0].endCompanyName ||
															deployments[0].primaryCompanyName,
													)}
												</span>
											</span>
											<span className="text-[10px] text-muted-foreground block">
												{deployments[0].roleTitle || "General Deployment"}
											</span>
										</div>
									) : (
										<span className="font-medium text-muted-foreground">
											Internal (Brainee.org)
										</span>
									)}
								</div>
							</div>

							{/* Sign Out Button */}
							<div className="pt-2 border-t border-border/40">
								<Button
									variant="outline"
									size="sm"
									onClick={handleSignOut}
									disabled={isLoggingOut}
									className="w-full text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 gap-1.5 cursor-pointer h-8"
								>
									<LogOut className="size-3.5" />
									{isLoggingOut ? "Signing out..." : "Sign Out"}
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>

				{/* Right Column: Assigned Equipment & Accounts */}
				<div className="lg:col-span-7">
					{user?.id && (
						<EmployeeEquipmentSection
							userId={user.id}
							isAdmin={false}
							hideDeployments={true}
							onDeploymentsLoaded={setDeployments}
						/>
					)}
				</div>
			</div>
		</Page>
	);
}
