import type { PitchPackage } from "./pitch-types.ts";

const escapeHtml = (value: string) =>
	value.replace(
		/[&<>"']/g,
		(char) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				char
			] ?? char,
	);

const styles = `
body{margin:0;background:#f8f9fa;color:#202020;font:16px/1.6 Arial,sans-serif}
main{max-width:1000px;margin:auto;padding:24px}
section{box-sizing:border-box;background:white;border:1px solid #ddd;border-radius:14px;padding:40px;margin-bottom:24px;overflow-wrap:anywhere}
h1{font-size:34px;line-height:1.25}h2{font-size:28px;line-height:1.3}p{white-space:pre-wrap}
.meta,footer{font-size:12px;color:#65616e}.slide{min-height:500px}.slide>p{font-size:24px}
.gap{font-size:14px;color:#815616}header{padding:16px 0}.appendix p{font-size:12px}
@media(max-width:600px){section{padding:20px}h1{font-size:26px}.slide>p{font-size:18px}}
@media print{
body{background:white}main{max-width:none;padding:0}section{border:0;border-radius:0;margin:0}
header{padding:20px}section h2{break-after:avoid}p{orphans:3;widows:3}
body[data-mode=presentation] header{box-sizing:border-box;height:7.5in;break-after:page;padding:80px 64px;background:#efedfd}
body[data-mode=presentation] section{min-height:7.49in;break-after:page;padding:48px 64px}
body[data-mode=presentation] section:last-child{break-after:auto}
body[data-mode=document] section{padding:0 20px 24px}
}
`;

/** Trusted template only. Model text is always escaped, never executed as HTML. */
export function pitchHtml(
	pitch: PitchPackage,
	mode: "presentation" | "document",
) {
	const sections = pitch.sections
		.map((section) => {
			const sources = section.sourceIds
				.map((id) => pitch.sources.find((source) => source.id === id))
				.filter((source) => !!source);
			const gaps =
				mode === "presentation"
					? section.gaps.length
						? `<div class="gap">${section.gaps.length} items need review; see review appendix.</div>`
						: ""
					: section.gaps
							.map((gap) => `<div class="gap">Review: ${escapeHtml(gap)}</div>`)
							.join("");
			return `<section class="${mode === "presentation" ? "slide" : "document"}" data-section="${escapeHtml(section.id)}">
<div class="meta">${escapeHtml(section.kind.replaceAll("_", " "))} · ${escapeHtml(pitch.audience)}</div>
<h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(mode === "presentation" ? section.slide : section.document)}</p>${gaps}
<footer>${sources
				.slice(0, 4)
				.map((source) => escapeHtml(source.label.slice(0, 100)))
				.join(" · ")}</footer></section>`;
		})
		.join("");
	const gaps = pitch.sections.flatMap((section) =>
		section.gaps.map((gap) => `${section.title}: ${gap}`),
	);
	const appendix = `<section class="appendix" data-section="evidence-appendix"><h2>Evidence and review appendix</h2>
${gaps.map((gap) => `<p class="gap">Review: ${escapeHtml(gap)}</p>`).join("")}
${pitch.sources.map((source) => `<h3>${escapeHtml(source.label)}</h3><div class="meta">${source.kind === "public" ? "Public reference; not company delivery evidence" : "Workspace evidence"}</div><p>${escapeHtml(source.excerpt)}</p>${source.url ? `<p>${escapeHtml(source.url)}</p>` : ""}`).join("")}</section>`;
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(pitch.title)}</title><style>${styles}</style></head>
<body data-mode="${mode}"><main><header><div class="meta">INTERNAL DRAFT · REVISION ${pitch.revision}</div><h1>${escapeHtml(pitch.title)}</h1><p>${escapeHtml(pitch.objective)}</p><p>${escapeHtml(pitch.audience)}</p></header>${sections}${appendix}</main></body></html>`;
}
