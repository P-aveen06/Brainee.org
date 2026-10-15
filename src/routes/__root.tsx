import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { NotFound } from "#/components/layout/NotFound";
import { MotionProvider } from "#/components/motion";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Brainee.org",
			},
		],
		links: [
			{ rel: "manifest", href: "/manifest.json" },
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/brainee-logo.svg",
			},
			{
				rel: "apple-touch-icon",
				href: "/brainee-logo.svg",
			},
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com",
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400..800;1,400..800&family=Shantell+Sans:ital,wght@0,300..800;1,300..800&family=Sometype+Mono:ital,wght@0,400..700;1,400..700&display=swap",
			},
		],
	}),
	notFoundComponent: NotFound,
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body suppressHydrationWarning>
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
					<MotionProvider>{children}</MotionProvider>
					<Toaster position="top-right" closeButton richColors />
				</ThemeProvider>
				<Scripts />
			</body>
		</html>
	);
}
