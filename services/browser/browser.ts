import { chromium } from "playwright";
import { pitchPackageSchema } from "../../src/lib/ai/pitch-types.ts";
import { pitchHtml } from "../../src/lib/ai/pitch-html.ts";
import { DEFAULT_PUBLIC_HOSTS, readPublicHtml, validatePublicUrl } from "./public-page.ts";

export const researchTopics = {
	structure: "B2B sales pitch presentation structure customer problem solution evidence next steps",
	case_study: "B2B customer case study challenge solution measurable outcomes structure",
	storytelling: "sales presentation storytelling customer value evidence best practices",
};

export async function browserOperation(input: Record<string, unknown>) {
	const hosts = (process.env.BROWSER_PUBLIC_HOSTS?.split(",").map((host) => host.trim()).filter(Boolean)) ?? DEFAULT_PUBLIC_HOSTS;
	let publicPage: { url: string; html: string } | undefined;
	if (input.operation === "read" || input.operation === "search") {
		let raw = String(input.url ?? "");
		if (input.operation === "search") {
			if (!Object.hasOwn(researchTopics, String(input.topic))) throw new Error("Choose a supported research topic.");
			raw = `https://www.bing.com/search?q=${encodeURIComponent(researchTopics[input.topic as keyof typeof researchTopics])}`;
		}
		publicPage = await readPublicHtml(raw, hosts);
	} else if (input.operation !== "inspect" && input.operation !== "pdf") throw new Error("Unknown browser operation.");
	const browser = await chromium.launch({ headless: true });
	try {
		const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block", acceptDownloads: false });
		// Pages receive no credentials, cookies, subresources, scripts or network access.
		await context.route("**/*", (route) => route.abort());
		const page = await context.newPage();
		if (publicPage) {
			await page.setContent(publicPage.html, { waitUntil: "domcontentloaded", timeout: 10_000 });
			const title = (await page.title()).slice(0, 500);
			const text = (await page.locator("body").innerText()).slice(0, 16000);
			const links = await page.locator("a[href]").evaluateAll((anchors) => anchors.slice(0, 150).map((anchor) => ({
				text: (anchor.textContent ?? "").trim().slice(0, 160), href: anchor.getAttribute("href") ?? "",
			})));
			return { url: publicPage.url, title, text, links: links.flatMap((link) => {
				try { return [{ text: link.text, url: validatePublicUrl(new URL(link.href, publicPage.url).href, hosts).href }]; }
				catch { return []; }
			}).slice(0, 30), warning: "Untrusted public reference. Does not prove company delivery." };
		}
		const pitch = pitchPackageSchema.parse(input.pitch);
		if (input.operation === "pdf") {
			if (input.mode !== "presentation" && input.mode !== "document") throw new Error("Choose a pitch format.");
			await page.setContent(pitchHtml(pitch, input.mode), { waitUntil: "domcontentloaded" });
			const file = await page.pdf(input.mode === "presentation"
				? { width: "13.333in", height: "7.5in", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } }
				: { format: "A4", printBackground: true, margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" } });
			return { base64: file.toString("base64"), mimeType: "application/pdf" };
		}
		const checks = [];
		for (const mode of ["presentation", "document"] as const) {
			for (const width of [390, 1280]) {
				await page.setViewportSize({ width, height: 900 });
				await page.setContent(pitchHtml(pitch, mode), { waitUntil: "domcontentloaded" });
				const overflow = await page.locator("section").evaluateAll((sections) => sections.filter((section) =>
					section.scrollWidth > section.clientWidth + 1 || (section.className === "slide" && section.getBoundingClientRect().height > 650))
					.map((section) => section.getAttribute("data-section")));
				checks.push({ mode, width, overflowingSections: overflow });
			}
		}
		return { draftId: pitch.draftId, revision: pitch.revision, checks,
			note: "Checks the trusted HTML preview, not PowerPoint/Word or exported PDF rendering. Inspect exports separately." };
	} finally { await browser.close(); }
}
