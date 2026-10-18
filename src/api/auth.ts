import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createLogoutCookie, setResponseCookieHeader } from "#/lib/auth.server";
import { signInAsDemoPerson } from "#/lib/demo-login.server";

export const loginUser = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({ employeeId: z.string().min(1).max(100) })
			.strict()
			.parse(data),
	)
	.handler(async ({ data }) => signInAsDemoPerson(data.employeeId));

export const logoutUser = createServerFn({ method: "POST" }).handler(
	async () => {
		setResponseCookieHeader(createLogoutCookie());
		throw redirect({ to: "/sign-in/$" });
	},
);
