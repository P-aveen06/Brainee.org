import { ArrowUpRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PitchPackage } from "@/lib/ai/pitch-types";
import { useOpenPitch } from "./PitchWorkspace";

export function PitchArtifactCard({ pitch }: { pitch: PitchPackage }) {
	const open = useOpenPitch();
	return (
		<Button
			variant="outline"
			className="my-3 h-auto w-full justify-start gap-3 rounded-xl bg-accent/5 px-4 py-4 text-left"
			onClick={() => open(pitch)}
		>
			<FileText className="size-5 shrink-0 text-accent" />
			<span className="min-w-0 flex-1">
				<span className="block truncate font-bold">{pitch.title}</span>
				<span className="block text-xs font-normal text-muted-foreground">
					Presentation + document · Draft v{pitch.revision} ·{" "}
					{pitch.sections.length} sections
				</span>
			</span>
			<ArrowUpRight className="size-4 shrink-0" />
		</Button>
	);
}
