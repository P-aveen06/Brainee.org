import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/audit")({
	beforeLoad: () => {
		throw redirect({ to: "/admin" });
	},
});
