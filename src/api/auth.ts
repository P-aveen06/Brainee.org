import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	createLogoutCookie,
	setResponseCookieHeader,
	signInWithPassword,
} from "#/lib/auth.server";

export const loginUser = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				email: z.string().trim().email().max(254),
				password: z.string().min(1).max(256),
			})
			.parse(data),
	)
	.handler(async ({ data }) => signInWithPassword(data));

export const logoutUser = createServerFn({ method: "POST" }).handler(
	async () => {
		setResponseCookieHeader(createLogoutCookie());
		throw redirect({ to: "/sign-in/$" });
	},
);
