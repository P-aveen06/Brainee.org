import { Moon, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
	const { theme, setTheme, resolvedTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const current = theme === "system" ? resolvedTheme : theme;
	const isDark = mounted && current === "dark";

	return (
		<SidebarMenuButton
			type="button"
			onClick={() => setTheme(current === "dark" ? "light" : "dark")}
			tooltip={isDark ? "Switch to light" : "Switch to dark"}
			aria-label="Toggle theme"
			aria-pressed={isDark}
			className="h-8 gap-2.5 rounded-xl px-2.5 text-[13px] text-sidebar-foreground/70 hover:bg-card/60 hover:text-foreground"
		>
			<span aria-hidden="true" className="relative size-4 shrink-0">
				<SunMedium
					className={cn(
						"absolute inset-0 size-4 transition-[opacity,transform] duration-500 ease-bounce",
						isDark && "scale-50 -rotate-90 opacity-0",
					)}
				/>
				<Moon
					className={cn(
						"absolute inset-0 size-4 transition-[opacity,transform] duration-500 ease-bounce",
						!isDark && "scale-50 rotate-90 opacity-0",
					)}
				/>
			</span>
			<span className="flex-1">{isDark ? "Dark" : "Light"}</span>
			<span
				aria-hidden="true"
				className={cn(
					"relative h-5 w-9 shrink-0 rounded-full transition-colors duration-300 ease-standard group-data-[collapsible=icon]:hidden",
					isDark ? "bg-primary" : "bg-muted-foreground/30",
				)}
			>
				<span
					className={cn(
						"absolute top-0.5 left-0.5 flex size-4 items-center justify-center rounded-full bg-background shadow-sm transition-transform duration-500 ease-bounce",
						isDark && "translate-x-4",
					)}
				>
					{isDark ? (
						<Moon className="size-2.5 text-foreground" />
					) : (
						<SunMedium className="size-2.5 text-foreground" />
					)}
				</span>
			</span>
		</SidebarMenuButton>
	);
}
