import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { pitchFixture } from "../src/lib/ai/pitch-test-fixture.ts";
import { powerpointBlob, wordBlob } from "../src/lib/ai/pitch-office-exports.ts";

const { pitch } = pitchFixture();
const folder = "/private/tmp/brainee-pitch-verification";
await mkdir(folder, { recursive: true });
for (const [extension, blob] of [["pptx", await powerpointBlob(pitch)], ["docx", await wordBlob(pitch)]] as const) {
	const bytes = new Uint8Array(await blob.arrayBuffer());
	assert.equal(Buffer.from(bytes.slice(0, 2)).toString(), "PK");
	await writeFile(`${folder}/pitch.${extension}`, bytes);
	console.log(`${extension}: editable OOXML file generated (${bytes.length} bytes)`);
}
const token = process.env.BROWSER_SERVICE_TOKEN;
assert.ok(token, "Set local browser credentials with --env-file=.dev.vars");
async function call(input: unknown) {
	const response = await fetch("http://127.0.0.1:3200/operations", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(input) });
	const body = await response.json() as { data?: Record<string, unknown>; error?: string };
	assert.ok(response.ok, body.error); return body.data!;
}
const inspected = await call({ operation: "inspect", pitch });
console.log("Layout inspection:", JSON.stringify(inspected));
for (const mode of ["presentation", "document"]) {
	const data = await call({ operation: "pdf", pitch, mode });
	const bytes = Buffer.from(String(data.base64), "base64"); assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
	await writeFile(`${folder}/${mode}.pdf`, bytes); console.log(`${mode} PDF: ${bytes.length} bytes`);
}
const denied = await fetch("http://127.0.0.1:3200/operations", { method: "POST", body: "{}" });
assert.equal(denied.status, 401);
console.log("Unauthenticated browser request rejected.");
if (process.argv.includes("--public")) {
	const data = await call({ operation: "read", url: "https://www.assistant-ui.com/components" });
	assert.equal(typeof data.text, "string"); console.log("Public research verified:", data.title);
	const search = await call({ operation: "search", topic: "case_study" });
	assert.equal(typeof search.text, "string"); console.log("Generic web search verified:", search.title);
}
