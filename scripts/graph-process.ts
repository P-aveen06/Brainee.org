import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

export const image = "falkordb/falkordb:6.0.2@sha256:107455e862a824e45e8e9f5a7fbfdf5e00a08b14e13eae2577c72fd9e3f59ba6";

export function run(program: string, args: string[], capture = false): string {
	const result = spawnSync(program, args, {
		cwd: process.cwd(), encoding: "utf8", stdio: capture ? "pipe" : "inherit",
	});
	if (result.error || result.status !== 0) {
		throw new Error(`${program} command failed. Check Docker Desktop and the preceding output.`);
	}
	return result.stdout ?? "";
}

export function compose(args: string[], capture = false) {
	const options = ["--env-file", ".local/falkordb/.env", "-f", "compose.yaml", ...args];
	const standard = spawnSync("docker", ["compose", "version"], { stdio: "ignore" });
	if (standard.status === 0) return run("docker", ["compose", ...options], capture);
	const bundled = "/Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose";
	if (existsSync(bundled)) return run(bundled, options, capture);
	return run("docker-compose", options, capture);
}
