import { lookup } from "node:dns/promises";
import type { LookupAddress, LookupOptions } from "node:dns";
import { request } from "node:https";
import { isIP } from "node:net";

export const DEFAULT_PUBLIC_HOSTS = [
	"assistant-ui.com", "www.assistant-ui.com", "pitch.com", "www.pitch.com",
	"hubspot.com", "www.hubspot.com", "blog.hubspot.com", "salesforce.com", "www.salesforce.com",
	"ycombinator.com", "www.ycombinator.com", "www.bing.com",
];

export function isPublicAddress(address: string): boolean {
	if (isIP(address) === 4) {
		const [a, b] = address.split(".").map(Number);
		return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
			(a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) ||
			(a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0));
	}
	// Restrict IPv6 to globally routable unicast; exclude documentation and transition ranges.
	return isIP(address) === 6 && /^[23]/i.test(address) &&
		!/^2001:(?:db8|0:|0000:)/i.test(address) && !/^2002:/i.test(address);
}

export function validatePublicUrl(raw: string, hosts: string[]) {
	const url = new URL(raw);
	if (url.protocol !== "https:" || url.username || url.password ||
		(url.port && url.port !== "443") || !hosts.includes(url.hostname.toLowerCase()))
		throw new Error("Choose an HTTPS page on an administrator-approved public host.");
	url.hash = "";
	return url;
}

export function createPinnedLookup(address: string, family: number) {
	return (_hostname: string, options: LookupOptions, callback: (
		error: NodeJS.ErrnoException | null,
		resolved: string | LookupAddress[],
		resolvedFamily?: number,
	) => void) => {
		if (options.all) callback(null, [{ address, family }]);
		else callback(null, address, family);
	};
}

export async function readPublicHtml(raw: string, hosts: string[], redirects = 0): Promise<{ url: string; html: string }> {
	const url = validatePublicUrl(raw, hosts);
	const addresses = await lookup(url.hostname, { all: true });
	if (!addresses.length || addresses.some((entry) => !isPublicAddress(entry.address)))
		throw new Error("Private and reserved destinations are not allowed.");
	const selected = addresses[0];
	const result = await new Promise<{ status: number; location?: string; html: string }>((resolve, reject) => {
		const req = request(url, {
			headers: { "user-agent": "BraineeResearch/1.0", accept: "text/html" },
			// Pin the checked address, including across DNS changes. TLS still verifies the hostname.
			lookup: createPinnedLookup(selected.address, selected.family),
		}, (res) => {
			if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
				res.resume(); resolve({ status: res.statusCode, location: res.headers.location, html: "" }); return;
			}
			if (!res.headers["content-type"]?.includes("text/html")) {
				res.destroy(); reject(new Error("Only public HTML pages can be read.")); return;
			}
			const chunks: Buffer[] = []; let size = 0;
			res.on("data", (chunk: Buffer) => {
				size += chunk.length;
				if (size > 1_000_000) { res.destroy(); reject(new Error("Page exceeds research size limit.")); }
				else chunks.push(chunk);
			});
			res.on("end", () => resolve({ status: res.statusCode ?? 500, html: Buffer.concat(chunks).toString("utf8") }));
			res.on("error", reject);
		});
		req.setTimeout(10_000, () => req.destroy(new Error("Public page timed out.")));
		req.on("error", reject); req.end();
	});
	if (result.location) {
		if (redirects >= 3) throw new Error("Too many public-page redirects.");
		return readPublicHtml(new URL(result.location, url).href, hosts, redirects + 1);
	}
	if (result.status < 200 || result.status >= 300) throw new Error(`Public page returned ${result.status}.`);
	return { url: url.href, html: result.html };
}
