import type { PitchPackage } from "./pitch-types";

export function pitchFileName(pitch: PitchPackage) {
	return `${
		pitch.title
			.replace(/[^a-z0-9]+/gi, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 80) || "pitch"
	}-v${pitch.revision}`;
}

export async function powerpointBlob(pitch: PitchPackage): Promise<Blob> {
	const { default: PptxGenJS } = await import("pptxgenjs");
	const deck = new PptxGenJS();
	deck.layout = "LAYOUT_WIDE";
	deck.title = pitch.title;
	deck.subject = pitch.objective;
	deck.author = "Company Brain";
	deck.theme = { headFontFace: "Arial", bodyFontFace: "Arial" };
	const cover = deck.addSlide();
	cover.background = { color: "EFEDFD" };
	cover.addText("COMPANY BRAIN · INTERNAL DRAFT", {
		x: 0.7,
		y: 0.65,
		w: 11.8,
		h: 0.4,
		fontSize: 12,
		color: "7612FA",
	});
	cover.addText(pitch.title, {
		x: 0.7,
		y: 1.6,
		w: 11.8,
		h: 2,
		fontSize: 36,
		bold: true,
		color: "202020",
		breakLine: false,
		fit: "shrink",
	});
	cover.addText(pitch.objective, {
		x: 0.7,
		y: 4,
		w: 11.8,
		h: 1.2,
		fontSize: 20,
		color: "52525B",
		fit: "shrink",
	});
	cover.addText(`${pitch.audience} · Revision ${pitch.revision}`, {
		x: 0.7,
		y: 6.5,
		w: 11.8,
		h: 0.4,
		fontSize: 12,
		color: "52525B",
	});
	for (const [index, section] of pitch.sections.entries()) {
		const slide = deck.addSlide();
		slide.background = { color: "FFFFFF" };
		slide.addText(section.kind.replaceAll("_", " ").toUpperCase(), {
			x: 0.7,
			y: 0.5,
			w: 11.8,
			h: 0.35,
			fontSize: 12,
			color: "7612FA",
		});
		slide.addText(section.title, {
			x: 0.7,
			y: 1.05,
			w: 11.8,
			h: 1,
			fontSize: 28,
			bold: true,
			color: "202020",
			fit: "shrink",
		});
		slide.addText(section.slide, {
			x: 0.7,
			y: 2.3,
			w: 11.8,
			h: 2.6,
			fontSize: 23,
			color: "202020",
			fit: "shrink",
			valign: "top",
			margin: 0,
		});
		const sources = section.sourceIds
			.map((id) => pitch.sources.find((source) => source.id === id))
			.filter((source) => !!source);
		if (section.gaps.length)
			slide.addText(
				`${section.gaps.length} items need review. See speaker notes for details.`,
				{ x: 0.7, y: 5.25, w: 11.8, h: 0.75, fontSize: 12, color: "815616" },
			);
		slide.addText(
			`${sources
				.slice(0, 4)
				.map((source) => source.label.slice(0, 100))
				.join(" · ")}\nInternal draft · ${index + 2}`,
			{
				x: 0.7,
				y: 6.35,
				w: 11.8,
				h: 0.6,
				fontSize: 10,
				color: "686575",
				fit: "shrink",
			},
		);
		slide.addNotes(
			[
				section.document,
				...section.gaps.map((gap) => `Review: ${gap}`),
				...sources.map(
					(source) =>
						`${source.kind}: ${source.label}\n${source.excerpt}${source.url ? `\n${source.url}` : ""}`,
				),
			].join("\n\n"),
		);
	}
	const result = await deck.write({ outputType: "blob" });
	if (!(result instanceof Blob))
		throw new Error("PowerPoint export did not return a file.");
	return result;
}

export async function wordBlob(pitch: PitchPackage): Promise<Blob> {
	const {
		Document,
		Packer,
		Paragraph,
		TextRun,
		HeadingLevel,
		ExternalHyperlink,
	} = await import("docx");
	const paragraph = (text: string) =>
		new Paragraph({ children: [new TextRun(text)], spacing: { after: 180 } });
	const sections = pitch.sections.flatMap((section) => [
		new Paragraph({
			text: section.title,
			heading: HeadingLevel.HEADING_1,
			keepNext: true,
		}),
		...section.document.split(/\n+/).map(paragraph),
		...section.gaps.map((gap) => paragraph(`Review needed: ${gap}`)),
		paragraph(
			`Sources: ${section.sourceIds.map((id) => pitch.sources.find((source) => source.id === id)?.label ?? id).join("; ") || "Proposed narrative; no delivery claim"}`,
		),
	]);
	const references = pitch.sources.flatMap((source) => [
		new Paragraph({
			text: `${source.label} (${source.kind === "workspace" ? "Workspace evidence" : "Public reference"})`,
			heading: HeadingLevel.HEADING_2,
			keepNext: true,
		}),
		paragraph(source.excerpt),
		...(source.url
			? [
					new Paragraph({
						children: [
							new ExternalHyperlink({
								link: source.url,
								children: [
									new TextRun({ text: source.url, style: "Hyperlink" }),
								],
							}),
						],
					}),
				]
			: []),
	]);
	return Packer.toBlob(
		new Document({
			title: pitch.title,
			creator: "Company Brain",
			description: pitch.objective,
			styles: {
				default: {
					document: {
						run: { font: "Arial", size: 22 },
						paragraph: { spacing: { line: 300 } },
					},
				},
			},
			sections: [
				{
					properties: {
						page: {
							margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
						},
					},
					children: [
						paragraph(`INTERNAL DRAFT · REVISION ${pitch.revision}`),
						new Paragraph({ text: pitch.title, heading: HeadingLevel.TITLE }),
						paragraph(`Audience: ${pitch.audience}`),
						paragraph(pitch.objective),
						...sections,
						new Paragraph({
							text: "Evidence appendix",
							heading: HeadingLevel.HEADING_1,
						}),
						...references,
					],
				},
			],
		}),
	);
}

export function downloadPitchFile(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
