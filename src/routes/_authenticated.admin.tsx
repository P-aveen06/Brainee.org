import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { checkOnboardingUser } from "../api/users";

export const Route = createFileRoute("/_authenticated/admin")({
	beforeLoad: async () => {
		const user = await checkOnboardingUser();
		if (!user || user.role !== "admin") {
			throw redirect({ to: "/" });
		}
	},
	component: () => <Outlet />,
});
