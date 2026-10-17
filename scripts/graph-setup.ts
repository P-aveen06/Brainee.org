import { createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const keys = ["GRAPH_ADMIN_PASSWORD", "GRAPH_APP_PASSWORD", "GRAPH_SERVICE_TOKEN"] as const;

export function localSecrets() {
	const file = ".local/falkordb/.env";
	if (!existsSync(file)) throw new Error("Run bun run graph:setup first.");
	const values = Object.fromEntries(readFileSync(file, "utf8").trim().split("\n").map(line => line.split("=")));
	for (const key of keys) {
		if (!/^[a-f0-9]{64}$/.test(values[key] ?? "")) throw new Error(`Invalid local ${key}.`);
	}
	return values as Record<typeof keys[number], string>;
}

export function setupGraph() {
	mkdirSync(".local", { recursive: true, mode: 0o700 });
	chmodSync(".local", 0o700);
	mkdirSync(".local/falkordb", { recursive: true, mode: 0o700 });
	chmodSync(".local/falkordb", 0o700);
	const file = ".local/falkordb/.env";
	if (!existsSync(file)) {
		writeFileSync(file, keys.map(key => `${key}=${randomBytes(32).toString("hex")}`).join("\n") + "\n", { mode: 0o600, flag: "wx" });
	}
	const secrets = localSecrets();
	const hash = (value: string) => createHash("sha256").update(value).digest("hex");
	const acl = [
		"user default off",
		`user admin on #${hash(secrets.GRAPH_ADMIN_PASSWORD)} ~* &* +@all`,
		`user app on #${hash(secrets.GRAPH_APP_PASSWORD)} ~brainee_dev ~brainee_test_* +@connection +info +graph.query +graph.ro_query`,
	].join("\n") + "\n";
	writeFileSync(".local/falkordb/users.acl", acl, { mode: 0o600 });
	chmodSync(file, 0o600);

 const varsFile=".dev.vars";
 let vars=existsSync(varsFile)?readFileSync(varsFile,"utf8"):"";
 for(const [key,value] of Object.entries({GRAPH_SERVICE_URL:"http://127.0.0.1:3100",GRAPH_SERVICE_TOKEN:secrets.GRAPH_SERVICE_TOKEN})){
  const line=`${key}=${value}`;
  vars=new RegExp(`^${key}=.*$`,"m").test(vars)?vars.replace(new RegExp(`^${key}=.*$`,"m"),line):vars.trimEnd()+"\n"+line+"\n";
 }
 writeFileSync(varsFile,vars,{mode:0o600});chmodSync(varsFile,0o600);
	console.log("Local graph credentials ready; existing passwords retained. Worker connection configured. No records seeded.");
}
