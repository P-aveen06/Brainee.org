import { useRouter } from "@tanstack/react-router";
import { ChevronsUpDown, LogOut, User as UserIcon } from "lucide-react";
import { logoutUser } from "#/api/auth";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "#/components/ui/sidebar";
import { getInitials } from "#/lib/utils";

interface NavUserMenuProps {
	user?: {
		name: string;
		email: string;
		avatarUrl?: string | null;
	};
}

export function NavUserMenu({ user }: NavUserMenuProps) {
	const router = useRouter();
	const initials = getInitials(user?.name);

	const handleSignOut = async () => {
		try {
			await logoutUser();
			router.navigate({ to: "/sign-in/$" });
		} catch (error) {
			console.error("Sign out failed", error);
			window.location.href = "/sign-in";
		}
	};

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton
								size="lg"
								tooltip={user?.name || "User menu"}
								className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
							/>
						}
					>
						<Avatar className="size-8 rounded-lg">
							<AvatarImage
								src={user?.avatarUrl || undefined}
								alt={user?.name || "User"}
							/>
							<AvatarFallback className="rounded-lg bg-sidebar-foreground/15 text-sidebar-foreground text-xs">
								{initials}
							</AvatarFallback>
						</Avatar>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-medium">
								{user?.name || "User Profile"}
							</span>
							<span className="truncate text-xs text-sidebar-foreground/60">
								{user?.email || ""}
							</span>
						</div>
						<ChevronsUpDown className="ml-auto size-4 text-sidebar-foreground/50" />
					</DropdownMenuTrigger>
					<DropdownMenuContent
						side="right"
						align="end"
						sideOffset={8}
						className="w-56 rounded-xl p-1"
					>
						<DropdownMenuLabel className="p-2 font-normal">
							<div className="flex items-center gap-2 text-left text-sm">
								<Avatar className="size-8 rounded-lg">
									<AvatarImage
										src={user?.avatarUrl || undefined}
										alt={user?.name || "User"}
									/>
									<AvatarFallback className="rounded-lg bg-surface-alt text-foreground text-xs">
										{initials}
									</AvatarFallback>
								</Avatar>
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-medium text-foreground">
										{user?.name || "User Profile"}
									</span>
									<span className="truncate text-xs text-muted-foreground">
										{user?.email || ""}
									</span>
								</div>
							</div>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() => router.navigate({ to: "/profile" })}
							className="gap-2 cursor-pointer rounded-lg"
						>
							<UserIcon className="size-4 text-muted-foreground" />
							<span>Profile</span>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={handleSignOut}
							className="gap-2 cursor-pointer rounded-lg text-destructive focus:text-destructive"
						>
							<LogOut className="size-4 text-destructive" />
							<span>Sign out</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
